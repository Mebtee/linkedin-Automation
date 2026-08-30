/**
 * Phase 4 — Full User Journey End-to-End Integration Test
 *
 * Unites the ENTIRE real flow in a single journey, from course-PDF ingestion
 * through to LinkedIn publication and the scheduled cron, mirroring exactly
 * what a user does in the product:
 *
 *   1.  upload course PDF
 *   2.  validate + content-hash + duplicate check
 *   3.  extract text per page
 *   4.  match curriculum day
 *   5.  build journal proposal + evidence
 *   6.  user reviews/edits proposal
 *   7.  save + submit journal
 *   8.  generate post (fallback provider, no network AI)
 *   9.  generate image (SVG -> private storage)
 *  10.  approve post
 *  11.  publish manually to LinkedIn  OR  schedule for cron publish
 *  12.  schedule claimed + LinkedIn API called
 *  13.  linkedin_post_id persisted + status published
 *  14.  second scheduler execution publishes nothing
 *
 * External systems are faked (in-memory Supabase client + mocked fetch); the
 * $0-cost TemplateFallbackProvider is real, so no credentials/network except
 * the captured LinkedIn call. Never requires real credentials in CI.
 *
 * Also covers important failure branches:
 *   - duplicate PDF rejected (no duplicate rows)
 *   - non-PDF rejected
 *   - empty file rejected
 *   - scheduler rejected without/with wrong secret
 *   - expired LinkedIn token -> schedule failed (safe, no publish)
 *   - non-approved post cannot be scheduled
 *   - proposal MISSING fields / AI cannot invent personal experience
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";

vi.hoisted(() => {
  process.env.SCHEDULER_SECRET = process.env.SCHEDULER_SECRET ?? "journey-scheduler-secret";
  delete process.env.GEMINI_API_KEY;
  delete process.env.AI_TEXT_PROVIDER;
});

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createWriteClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

// ─── In-memory Supabase fake (grouped for the full journey) ─────────────────

type Row = Record<string, unknown>;

const PROFILE_SCOPED_TABLES = new Set([
  "generated_posts",
  "daily_learning_entries",
  "media_assets",
  "scheduled_posts",
  "linkedin_connections",
  "course_materials",
  "course_material_pages",
  "content_opportunities",
]);

type Filter = { col: string; op: "eq" | "lte" | "in"; val: unknown; allowUidFromPath?: boolean };

// course_material_pages has no profile_id; ownership is implied by the parent
// course_material row via RLS join. The fake models this by resolving the
// owning profile through course_materials.
function owningProfileOf(db: FakeDb, table: string, row: Row): unknown {
  if (!PROFILE_SCOPED_TABLES.has(table)) return undefined;
  if (typeof row.profile_id !== "undefined") return row.profile_id;
  if (table === "course_material_pages") {
    const cm = (db.tables.course_materials ?? []).find(
      (m) => m.id === row.course_material_id,
    );
    return cm?.profile_id;
  }
  return undefined;
}

class FakeQuery {
  private filters: Filter[] = [];
  private mode: "select" | "insert" | "update" | "delete" | "upsert" | null = null;
  private payload: Row | Row[] | null = null;
  private upsertOpts: { onConflict?: string } = {};
  private wantRowsAfterMutation = false;
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private selectColumns: string | null = null;
  private selectOpts: { count?: string; head?: boolean } | null = null;

  constructor(
    private readonly db: FakeDb,
    private readonly table: string,
  ) {}

  select(columns?: string, opts?: { count?: string; head?: boolean }): this {
    this.selectColumns = columns ?? null;
    this.selectOpts = opts ?? null;
    if (this.mode === null) this.mode = "select";
    if (this.mode !== "select") this.wantRowsAfterMutation = true;
    return this;
  }
  eq(col: string, val: unknown): this {
    this.filters.push({ col, op: "eq", val });
    return this;
  }
  in(col: string, vals: unknown[]): this {
    this.filters.push({ col, op: "in", val: vals });
    return this;
  }
  lte(col: string, val: unknown): this {
    this.filters.push({ col, op: "lte", val });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }): this {
    this.orderCol = col;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }
  limit(n: number): this {
    this.limitN = n;
    return this;
  }
  maybeSingle(): Promise<{ data: Row | null; error: null }> {
    return this.execute().then((res) => {
      const rows = (res.data as Row[]) ?? [];
      return { data: rows[0] ?? null, error: null };
    });
  }
  single(): Promise<{ data: Row | null; error: { message: string; code: string } | null }> {
    return this.execute().then((res) => {
      const rows = (res.data as Row[]) ?? [];
      if (rows.length === 0)
        return { data: null, error: { message: "No rows found", code: "PGRST116" } };
      return { data: rows[0]!, error: null };
    });
  }
  insert(values: Row | Row[]): this {
    this.mode = "insert";
    this.payload = values;
    return this;
  }
  upsert(values: Row | Row[], opts?: { onConflict?: string }): this {
    this.mode = "upsert";
    this.payload = values;
    this.upsertOpts = opts ?? {};
    return this;
  }
  update(values: Row): this {
    this.mode = "update";
    this.payload = values;
    return this;
  }
  delete(): this {
    this.mode = "delete";
    return this;
  }
  then<T1 = unknown, T2 = never>(
    onfulfilled?: (v: { data: Row[] | null; count: number | null; error: unknown }) => T1,
  ): PromiseLike<T1 | T2> {
    return this.execute().then(onfulfilled as never);
  }

  private allRows(): Row[] {
    const rows = this.db.tables[this.table] ?? (this.db.tables[this.table] = []);
    if (this.db.userId === null) return rows;
    if (!PROFILE_SCOPED_TABLES.has(this.table)) return rows;
    return rows.filter((r) => owningProfileOf(this.db, this.table, r) === this.db.userId);
  }

  private applyFilters(rows: Row[]): Row[] {
    let out = rows.filter((row) =>
      this.filters.every(({ col, op, val }) => {
        if (op === "eq") return row[col] === val;
        if (op === "in") return Array.isArray(val) && val.includes(row[col]);
        if (op === "lte") {
          const rv = row[col];
          if (typeof rv === "string" && typeof val === "string") return rv <= val;
          return Number(rv) <= Number(val);
        }
        return false;
      }),
    );
    if (this.orderCol) {
      out = [...out].sort((a, b) => {
        const av = String(a[this.orderCol!] ?? "");
        const bv = String(b[this.orderCol!] ?? "");
        return this.orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    if (this.limitN !== null) out = out.slice(0, this.limitN);
    return out;
  }

  private async execute(): Promise<{ data: Row[] | null; count: number | null; error: unknown }> {
    const rows = this.db.tables[this.table] ?? (this.db.tables[this.table] = []);
    const scopeEnforced =
      this.db.userId !== null && PROFILE_SCOPED_TABLES.has(this.table);

    if (this.mode === "select") {
      const matched = this.applyFilters(this.allRows());
      return { data: matched, count: matched.length, error: null };
    }
    if (this.mode === "insert") {
      const incoming = Array.isArray(this.payload) ? this.payload : [this.payload!];
      const inserted: Row[] = [];
      for (const raw of incoming) {
        const row: Row = {
          ...raw,
          id: typeof raw.id === "string" ? raw.id : crypto.randomUUID(),
          ...(this.table === "scheduled_posts" ? { attempt_count: raw.attempt_count ?? 0 } : {}),
          created_at: (raw.created_at as string) ?? new Date().toISOString(),
          updated_at: (raw.updated_at as string) ?? new Date().toISOString(),
        };
        if (scopeEnforced) {
          const owner = row.profile_id ?? owningProfileOf(this.db, this.table, row);
          if (owner !== undefined && owner !== this.db.userId) {
            return { data: null, count: null, error: { message: "RLS violation", code: "42501" } };
          }
        }
        rows.push(row);
        inserted.push(row);
      }
      if (this.wantRowsAfterMutation) return { data: inserted, count: inserted.length, error: null };
      return { data: null, count: null, error: null };
    }
    if (this.mode === "upsert") {
      const conflictKeys = (this.upsertOpts.onConflict ?? "id")
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean);
      const conflicts = (a: Row, b: Row): boolean =>
        conflictKeys.every((key) => a[key] === b[key]);
      const incoming = Array.isArray(this.payload) ? this.payload : [this.payload!];
      for (const raw of incoming) {
        if (scopeEnforced) {
          const owner = raw.profile_id ?? owningProfileOf(this.db, this.table, raw);
          if (owner !== undefined && owner !== this.db.userId) {
            return { data: null, count: null, error: { message: "RLS violation", code: "42501" } };
          }
        }
        const idx = rows.findIndex(
          (r) => conflicts(r, raw) && (!scopeEnforced || owningProfileOf(this.db, this.table, r) === this.db.userId),
        );
        if (idx >= 0) {
          rows[idx] = { ...rows[idx], ...raw, updated_at: new Date().toISOString() };
        } else {
          rows.push({
            ...raw,
            id: typeof raw.id === "string" ? raw.id : crypto.randomUUID(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
      if (this.wantRowsAfterMutation) return { data: rows, count: rows.length, error: null };
      return { data: null, count: null, error: null };
    }
    if (this.mode === "update") {
      const matched = this.applyFilters(this.allRows());
      const ids = new Set(matched.map((r) => r.id));
      for (const row of rows) {
        if (ids.has(row.id)) Object.assign(row, this.payload, { updated_at: new Date().toISOString() });
      }
      const updated = rows.filter((r) => ids.has(r.id));
      if (this.wantRowsAfterMutation) return { data: updated, count: updated.length, error: null };
      return { data: null, count: null, error: null };
    }
    if (this.mode === "delete") {
      const matched = this.applyFilters(this.allRows());
      const ids = new Set(matched.map((r) => r.id));
      this.db.tables[this.table] = rows.filter((r) => !ids.has(r.id));
      return { data: null, count: null, error: null };
    }
    return { data: null, count: 0, error: { message: "No op", code: "SYNTAX" } };
  }
}

class FakeDb {
  tables: Record<string, Row[]> = {};
  files = new Map<string, string>();
  constructor(public userId: string | null) {}

  client() {
    return {
      auth: {
        getUser: async () => ({
          data: { user: this.userId ? { id: this.userId } : null },
          error: null,
        }),
      },
      from: (table: string) => new FakeQuery(this, table),
      storage: {
        from: (bucket: string) => ({
          upload: async (path: string, body: string) => {
            this.files.set(`${bucket}/${path}`, String(body));
            return { data: { path }, error: null };
          },
          remove: async (paths: string[]) => {
            for (const p of paths) this.files.delete(`${bucket}/${p}`);
            return { data: paths, error: null };
          },
          download: async (path: string) => {
            const content = this.files.get(`${bucket}/${path}`);
            if (content === undefined) {
              return { data: null, error: { message: "Object not found" } };
            }
            return { data: new Blob([content], { type: "image/svg+xml" }), error: null };
          },
        }),
      },
    };
  }
}

// ─── Fixtures & wiring ───────────────────────────────────────────────────────

const USER_ID = "11111111-1111-4111-8111-111111111111";
const LINKEDIN_SUB = "li_member_sub_journey";
const LINKEDIN_TOKEN = "li-access-token-journey";
const SCHEDULER_SECRET = process.env.SCHEDULER_SECRET!;

const MODULE = {
  id: "mod-1",
  module_number: 1,
  title: "Foundations",
  start_day: 1,
  end_day: 15,
};
const DAY = {
  id: "cd-1",
  day_number: 1,
  module_id: "mod-1",
  week_number: 1,
  topic: "HTML Basics",
  content: "Structure of an HTML document, semantic tags, and accessibility basics.",
  subtopics: ["doctype", "semantic tags"],
  project_information: null,
  assessment_information: null,
};

function seedDatabase(db: FakeDb): void {
  db.tables.modules = [{ ...MODULE }];
  db.tables.curriculum_days = [{ ...DAY }];
  db.tables.profiles = [{ id: USER_ID, email: "journey@example.com", created_at: new Date().toISOString() }];
  db.tables.linkedin_connections = [
    {
      id: crypto.randomUUID(),
      profile_id: USER_ID,
      linkedin_sub: LINKEDIN_SUB,
      access_token: LINKEDIN_TOKEN,
      token_type: "bearer",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      scope: "openid profile email w_member_social",
      linkedin_name: "Journey Tester",
      linkedin_email: "journey@example.com",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  db.tables.course_materials = [];
  db.tables.course_material_pages = [];
  db.tables.daily_learning_entries = [];
  db.tables.generated_posts = [];
  db.tables.scheduled_posts = [];
  db.tables.media_assets = [];
  db.tables.content_opportunities = [];
}

let userDb: FakeDb;
let adminDb: FakeDb;
const fetchMock = vi.fn();

import { createClient, createWriteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestCourseMaterial } from "@/services/course-materials";
import { saveJournal, submitJournal } from "@/app/actions/journal";
import { approvePost, publishPost, updatePost } from "@/app/actions/generated-posts";
import {
  generateContentOpportunitiesForDayAction,
  selectBestContentOpportunityAction,
  generatePostFromOpportunityAction,
  getPostQualityForOpportunityAction,
} from "@/app/actions/content-opportunities";
import { generatePostImage } from "@/services/image/service";
import { schedulePost } from "@/services/scheduling";
import { POST as schedulerPOST } from "@/app/api/scheduler/publish/route";
import { buildTestPdf } from "./fixtures/pdf-fixture";

const JOURNAL_KEYS = [
  "whatILearned", "whatIPracticed", "whatIBuilt", "challenge", "howISolvedIt",
  "keyTakeaway", "tomorrowFocus", "projectName", "projectDescription",
  "codeReference", "resourcesUsed", "confidenceLevel", "additionalNotes",
] as const;

/** Mirrors the client's proposal → saveJournal input mapping. */
function proposalToSaveInput(proposal: { journal: Record<string, unknown> }, dayNumber: number) {
  return {
    dayNumber,
    ...Object.fromEntries(
      (JOURNAL_KEYS as readonly string[])
        .filter((k) => k !== "confidenceLevel")
        .filter((k) => proposal.journal[k] != null)
        .map((k) => [k, String(proposal.journal[k])]),
    ),
    confidenceLevel: null,
  };
}

beforeEach(() => {
  vi.resetModules();
  userDb = new FakeDb(USER_ID);
  adminDb = new FakeDb(null);
  seedDatabase(userDb);
  adminDb.tables = userDb.tables;
  adminDb.files = userDb.files;

  (createClient as unknown as Mock).mockResolvedValue(userDb.client());
  (createWriteClient as unknown as Mock).mockResolvedValue(userDb.client());
  (createAdminClient as unknown as Mock).mockReturnValue(adminDb.client());

  fetchMock.mockReset();
  // Route LinkedIn calls: image registration, image upload, then the post.
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes("/v2/assets")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          value: {
            uploadUrl: "https://media.upload.example/JOURNEY_ASSET",
            asset: "urn:li:digitalmediaAsset:JOURNEY_ASSET",
          },
        }),
      };
    }
    if (url.includes("media.upload.example")) {
      return { ok: true, status: 201, json: async () => ({}) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "urn:li:share:JOURNEY1" }),
    };
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Helper: run the full pre-publish journey from a PDF ────────────────────
//
// Every journey PDF starts with an explicit "Day 1" marker and a course-content
// sentence ("covers/explains…") so the deterministic matcher reliably selects
// Day 1 and the builder can populate whatILearned — mirroring a real course
// hand-out while keeping tests deterministic.

async function ingestToApprovedPost(pdfText: string[], fileName = "journey.pdf") {
  const pdfBytes = buildTestPdf(pdfText);
  const ingest = await ingestCourseMaterial(fileName, pdfBytes);
  expect(ingest.proposal.evidence.length).toBeGreaterThan(0);

  const dayNumber = ingest.proposal.curriculumDay;
  const saveInput = recruiterSaveInput(ingest.proposal, dayNumber);
  const saved = await saveJournal(saveInput);
  expect(saved.success).toBe(true);
  expect(saved.entryId).toBeTruthy();
  const submitted = await submitJournal({ entryId: saved.entryId! });
  expect(submitted.success).toBe(true);
  expect(submitted.status).toBe("submitted");

  // Submission builds recruiter-focused opportunities; generate the post from
  // the deterministic best one (the only daily generation path).
  const oppGen = await generateContentOpportunitiesForDayAction({ dayNumber });
  expect(oppGen.success).toBe(true);
  if (!oppGen.success) throw new Error(oppGen.error);
  const opportunity =
    oppGen.opportunities.find((o) => o.status === "selected") ??
    oppGen.opportunities[0] ??
    null;
  expect(opportunity).toBeTruthy();
  if (!opportunity) throw new Error("No content opportunities were created.");

  const draft = await generatePostFromOpportunityAction(opportunity.id);
  expect(draft.success).toBe(true);
  if (!draft.success) throw new Error(draft.error);
  const post = draft.post;
  expect(post.status).toBe("draft");
  expect(post.provider).toBe("fallback");
  expect(post.model).toBe("template-v1");
  expect(post.opportunity_id).toBe(opportunity.id);

  const approved = await approvePost(post.id);
  expect(approved.success).toBe(true);
  if (!approved.success) throw new Error(approved.error.message);

  const asset = await generatePostImage(post.id);
  expect(asset.generated_post_id).toBe(post.id);
  expect(asset.mime_type).toBe("image/svg+xml");
  expect(userDb.files.has(`post-images/${asset.storage_path}`)).toBe(true);

  return {
    ingest,
    dayNumber,
    post: approved.success ? approved.post : post,
    saved,
    asset,
  };
}

/**
 * Ingests a PDF, submits the journal, and generates a DRAFT post from the
 * deterministic best content opportunity (never approved). Mirrors a user
 * submitting their day sheet and landing on the Opportunities workspace.
 */
async function draftPostFromPdf(
  pdfText: string[],
  fileName: string,
  journalBuilder: (proposal: { journal: Record<string, unknown> }, dayNumber: number) => ReturnType<typeof proposalToSaveInput> = proposalToSaveInput,
) {
  const pdfBytes = buildTestPdf(pdfText);
  const ingest = await ingestCourseMaterial(fileName, pdfBytes);
  const dayNumber = ingest.proposal.curriculumDay;
  const saveInput = journalBuilder(ingest.proposal, dayNumber);
  const saved = await saveJournal(saveInput);
  await submitJournal({ entryId: saved.entryId! });

  const oppGen = await generateContentOpportunitiesForDayAction({ dayNumber });
  if (!oppGen.success) throw new Error(oppGen.error);
  const opportunity =
    oppGen.opportunities.find((o) => o.status === "selected") ??
    oppGen.opportunities[0] ??
    null;
  if (!opportunity) throw new Error("No content opportunities were created.");
  const draft = await generatePostFromOpportunityAction(opportunity.id);
  if (!draft.success) throw new Error(draft.error);
  return draft.post;
}

/**
 * Rich, USER_CONFIRMED journal for the recruiter journey. Mirrors a real user
 * finishing their day sheet: the PDF fills whatILearned; the user (test) then
 * completes the first-person practice/problem fields before submitting so the
 * journal carries confirmed implementation + debugging evidence.
 */
function recruiterSaveInput(
  proposal: { journal: Record<string, unknown> },
  dayNumber: number,
) {
  return {
    ...proposalToSaveInput(proposal, dayNumber),
    whatIBuilt:
      "built a full-stack notes REST API with Next.js API routes, Supabase Postgres, and OAuth sign-in",
    projectName: "notes-api",
    projectDescription:
      "a notes API using Next.js, Supabase with row level security, and an OAuth flow",
    challenge:
      "the API returned a permission denied error because the row level security policy blocked the query",
    howISolvedIt:
      "debugged the failing query and fixed the RLS policy by matching the owner_id before re-deploying",
    codeReference: "the notes-api RLS policy and Supabase queries",
    keyTakeaway:
      typeof proposal.journal.keyTakeaway === "string" && proposal.journal.keyTakeaway.trim()
        ? proposal.journal.keyTakeaway
        : "row level security must allow the querying user, not just the table",
    additionalNotes: "practiced debugging a permission denied failure end to end",
  };
}

// ─── The full journey ────────────────────────────────────────────────────────

describe("Phase 4 full user journey (PDF → LinkedIn publishing)", () => {
  it("runs the entire journey: PDF → proposal → journal → post → image → approve → schedule → cron publish → idempotent", async () => {
    // 1–9: ingestion through image + approval, proposal day matched by text.
    const { ingest, post } = await ingestToApprovedPost([
      "Day 1 HTML Basics — this chapter covers semantic tags and accessibility.",
    ]);
    expect(ingest.proposal.curriculumDay).toBe(1);
    expect(ingest.proposal.journal.whatILearned).toContain("semantic");

    // 10: schedule an approved post for the near future.
    const future = new Date(Date.now() + 60_000).toISOString();
    const schedule = await schedulePost({ post_id: post.id, scheduled_at: future });
    expect(schedule.status).toBe("scheduled");
    (schedule.scheduled_at as string) = new Date(Date.now() - 1000).toISOString();

    // 11–13: cron publisher claims, calls LinkedIn, persists both states.
    const res = await schedulerPOST(
      new Request("http://localhost/api/scheduler/publish", {
        method: "POST",
        headers: { authorization: `Bearer ${SCHEDULER_SECRET}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { processed: number; results: Array<{ status: string; postId: string }> };
    expect(body.processed).toBe(1);
    expect(body.results[0]!.status).toBe("published");

    // LinkedIn called with author URN from stored OpenID subject. The post
    // includes an image, so LinkedIn sees asset registration, the upload PUT,
    // and the UGC post itself (3 calls).
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const ugcCall = fetchMock.mock.calls.find(
      ([u]) => String(u) === "https://api.linkedin.com/v2/ugcPosts",
    ) as [string, RequestInit];
    expect(ugcCall).toBeDefined();
    const init = ugcCall[1];
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${LINKEDIN_TOKEN}`);
    const payloadBody = JSON.parse(init.body as string) as {
      author: string;
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: string };
          shareMediaCategory: string;
        };
      };
    };
    expect(payloadBody.author).toBe(`urn:li:person:${LINKEDIN_SUB}`);

    const finalSchedule = userDb.tables.scheduled_posts![0]!;
    expect(finalSchedule.status).toBe("published");
    expect(finalSchedule.linkedin_post_id).toBe("urn:li:share:JOURNEY1");
    expect(finalSchedule.attempt_count).toBe(1);
    expect(finalSchedule.last_error).toBeNull();

    const finalPost = userDb.tables.generated_posts!.find((r) => r.id === post.id)!;
    expect(finalPost.status).toBe("published");
    expect(finalPost.linkedin_post_id).toBe("urn:li:share:JOURNEY1");
    expect(finalPost.published_at).toBeTruthy();

    // 14: second cron execution publishes nothing (no duplicate publication).
    const res2 = await schedulerPOST(
      new Request("http://localhost/api/scheduler/publish", {
        method: "POST",
        headers: { authorization: `Bearer ${SCHEDULER_SECRET}` },
      }),
    );
    const body2 = (await res2.json()) as { processed: number };
    expect(body2.processed).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("supports manual publishing (non-scheduled) after the same ingestion journey", async () => {
    // LinkedIn connection lacks w_member_social by default; reauth with scope.
    userDb.tables.linkedin_connections![0]!.scope = "openid profile email w_member_social";

    const post = await draftPostFromPdf(
      ["Day 1 HTML Basics — this chapter covers semantic HTML tags."],
      "manual.pdf",
      (proposal, dayNumber) => recruiterSaveInput(proposal, dayNumber),
    );
    await approvePost(post.id);

    const pubResult = await publishPost(post.id);
    expect(pubResult.success).toBe(true);
    if (!pubResult.success) throw new Error(pubResult.error.message);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const finalPost = userDb.tables.generated_posts!.find((r) => r.id === post.id)!;
    expect(finalPost.status).toBe("published");
    expect(finalPost.linkedin_post_id).toBe("urn:li:share:JOURNEY1");
  });

  it("rejects a duplicate PDF without creating a second record", async () => {
    const pdfBytes = buildTestPdf(["Day 1 HTML Basics — covers semantic HTML."]);
    await ingestCourseMaterial("dup.pdf", pdfBytes);
    const before = userDb.tables.course_materials!.length;
    expect(before).toBe(1);

    await expect(ingestCourseMaterial("dup-copy.pdf", pdfBytes)).rejects.toMatchObject({
      code: "PDF_DUPLICATE",
    });
    expect(userDb.tables.course_materials!.length).toBe(1);
    // Only the original PDF object exists — the duplicate was never persisted.
    const storedPdfs = [...userDb.files.keys()].filter((p) => p.startsWith("course-materials/"));
    expect(storedPdfs).toHaveLength(1);
    expect(userDb.tables.course_material_pages!.length).toBe(1);
  });

  it("rejects a non-PDF file without storing anything", async () => {
    const notPdf = new TextEncoder().encode("definitely not a pdf");
    await expect(ingestCourseMaterial("fake.txt", notPdf)).rejects.toMatchObject({
      code: "PDF_NOT_PDF",
    });
    expect(userDb.tables.course_materials!.length).toBe(0);
  });

  it("rejects an empty file", async () => {
    await expect(ingestCourseMaterial("empty.pdf", new Uint8Array(0))).rejects.toMatchObject({
      code: "PDF_EMPTY",
    });
  });

  it("rejects the scheduler without or with a wrong secret", async () => {
    const noAuth = await schedulerPOST(
      new Request("http://localhost/api/scheduler/publish", { method: "POST" }),
    );
    expect(noAuth.status).toBe(401);

    const wrong = await schedulerPOST(
      new Request("http://localhost/api/scheduler/publish", {
        method: "POST",
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );
    expect(wrong.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails a due schedule when the LinkedIn token is expired — and never publishes", async () => {
    const { post } = await ingestToApprovedPost(["Day 1 HTML Basics — covers semantic HTML."]);
    // Expire the token on the seeded connection.
    userDb.tables.linkedin_connections![0]!.expires_at = new Date(Date.now() - 1000).toISOString();

    const future = new Date(Date.now() + 60_000).toISOString();
    const schedule = await schedulePost({ post_id: post.id, scheduled_at: future });
    (schedule.scheduled_at as string) = new Date(Date.now() - 1000).toISOString();

    const res = await schedulerPOST(
      new Request("http://localhost/api/scheduler/publish", {
        method: "POST",
        headers: { authorization: `Bearer ${SCHEDULER_SECRET}` },
      }),
    );
    const body = (await res.json()) as { results: Array<{ status: string; error: string }> };
    expect(body.results[0]!.status).toBe("failed");
    expect(body.results[0]!.error).toBe("LinkedIn not connected");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(userDb.tables.scheduled_posts![0]!.status).toBe("failed");
  });

  it("requires publishing scope (w_member_social) before manual publish", async () => {
    // Strip publish scope so the publish path must reject with INSUFFICIENT_SCOPE.
    userDb.tables.linkedin_connections![0]!.scope = "openid profile email";
    const post = await draftPostFromPdf(
      ["Day 1 HTML Basics — covers semantic HTML tags."],
      "scope.pdf",
      (proposal, dayNumber) => recruiterSaveInput(proposal, dayNumber),
    );
    await approvePost(post.id);

    const pubResult = await publishPost(post.id);
    expect(pubResult.success).toBe(false);
    if (!pubResult.success) {
      expect(pubResult.error.code).toBe("INSUFFICIENT_SCOPE");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("runs the Phase 5E recruiter journey: opportunity → generate → review → edit → approve → publish → published", async () => {
    // 1. Ingest the course PDF and submit a confirmed personal journal.
    const pdfBytes = buildTestPdf([
      "Day 1 HTML Basics — this chapter covers semantic tags and accessibility.",
    ]);
    const ingest = await ingestCourseMaterial("recruiter.pdf", pdfBytes);
    const dayNumber = ingest.proposal.curriculumDay;
    const saved = await saveJournal(recruiterSaveInput(ingest.proposal, dayNumber));
    expect(saved.success).toBe(true);
    const submitted = await submitJournal({ entryId: saved.entryId! });
    expect(submitted.success).toBe(true);

    // Phase 5B fix: submission itself builds recruiter-focused opportunities,
    // no separate "Build Today's Options" action required.
    const oppOutcome = submitted.opportunities;
    expect(oppOutcome?.status).toBe("created");
    if (oppOutcome?.status === "created") {
      expect(oppOutcome.count).toBeGreaterThan(0);
    }
    const dayRowsAfterSubmit = userDb.tables.content_opportunities!.filter(
      (o) => o.day_number === dayNumber,
    );
    expect(dayRowsAfterSubmit.length).toBeGreaterThan(0);
    // Journal submission and opportunity creation never touch LinkedIn.
    expect(fetchMock).not.toHaveBeenCalled();

    // 2. Re-running generation is idempotent — no duplicate rows are created.
    const oppGen = await generateContentOpportunitiesForDayAction({ dayNumber });
    expect(oppGen.success).toBe(true);
    if (!oppGen.success) throw new Error(oppGen.error);
    expect(oppGen.count).toBeGreaterThan(0);
    expect(
      userDb.tables.content_opportunities!.filter((o) => o.day_number === dayNumber)
        .length,
    ).toBe(dayRowsAfterSubmit.length);

    // 3. Mark the deterministic winner "selected" (Phase 5A score, not a 2nd engine).
    const best = await selectBestContentOpportunityAction();
    expect(best.success).toBe(true);
    if (!best.success) throw new Error(best.error);
    const opportunity = best.opportunity!;
    expect(opportunity).toBeTruthy();
    expect(opportunity.selection_reason).toBeTruthy();

    // 4. Generate the draft from the opportunity (still just a draft).
    const draft = await generatePostFromOpportunityAction(opportunity.id);
    expect(draft.success).toBe(true);
    if (!draft.success) throw new Error(draft.error);
    expect(draft.created).toBe(true);
    expect(draft.duplicate).toBe(false);
    expect(draft.post.status).toBe("draft");
    expect(draft.post.opportunity_id).toBe(opportunity.id);
    expect(draft.post.recruiter_quality_score).toBeTypeOf("number");

    // 5. The reviewer sees the stored quality summary on the opportunity card.
    const summary = await getPostQualityForOpportunityAction(opportunity.id);
    expect(summary.success).toBe(true);
    if (!summary.success) throw new Error(summary.error);
    expect(summary.post?.id).toBe(draft.post.id);
    expect(summary.post?.score).toBeTypeOf("number");
    expect(["strong", "ready", "needs_review", "do_not_publish"]).toContain(
      summary.post?.recommendation,
    );

    // 6. Editing the draft re-evaluates quality server-side (Phase 5D/E).
    const edited = await updatePost(draft.post.id, { opening: "Edited recruiter opening." });
    expect(edited.success).toBe(true);
    if (!edited.success) throw new Error(edited.error.message);
    expect(edited.post.opening).toBe("Edited recruiter opening.");
    expect(edited.quality).not.toBeUndefined();

    // 7. Approve — re-checked at approval time, then the opportunity advances.
    const approved = await approvePost(draft.post.id);
    expect(approved.success).toBe(true);
    if (!approved.success) throw new Error(approved.error.message);
    expect(approved.post.status).toBe("approved");
    const approvedRow = userDb.tables.content_opportunities!.find(
      (o) => o.id === opportunity.id,
    )!;
    expect(approvedRow.status).toBe("approved");

    // 8. Manual publish (approved → published). Author URN from stored subject.
    const pub = await publishPost(draft.post.id);
    expect(pub.success).toBe(true);
    if (!pub.success) throw new Error(pub.error.message);
    expect(pub.post.status).toBe("published");
    expect(pub.post.linkedin_post_id).toBe("urn:li:share:JOURNEY1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const ugcCall = fetchMock.mock.calls.find(
      ([u]) => String(u) === "https://api.linkedin.com/v2/ugcPosts",
    ) as [string, RequestInit];
    expect(ugcCall).toBeDefined();
    const payloadBody = JSON.parse(ugcCall[1].body as string) as {
      author: string;
    };
    expect(payloadBody.author).toBe(`urn:li:person:${LINKEDIN_SUB}`);
    const publishedRow = userDb.tables.content_opportunities!.find(
      (o) => o.id === opportunity.id,
    )!;
    expect(publishedRow.status).toBe("published");

    // 9. Idempotent: publishing again returns the existing result, no new call.
    const pubAgain = await publishPost(draft.post.id);
    expect(pubAgain.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never publishes an unapproved recruiter draft and never generates a second draft for the same opportunity", async () => {
    const pdfBytes = buildTestPdf([
      "Day 1 HTML Basics — this chapter covers semantic tags and accessibility.",
    ]);
    const ingest = await ingestCourseMaterial("recruiter-blocked.pdf", pdfBytes);
    const dayNumber = ingest.proposal.curriculumDay;
    const saved = await saveJournal(recruiterSaveInput(ingest.proposal, dayNumber));
    await submitJournal({ entryId: saved.entryId! });

    const oppGen = await generateContentOpportunitiesForDayAction({ dayNumber });
    if (!oppGen.success) throw new Error(oppGen.error);
    const best = await selectBestContentOpportunityAction();
    if (!best.success) throw new Error(best.error);
    const opportunity = best.opportunity!;

    const draft = await generatePostFromOpportunityAction(opportunity.id);
    if (!draft.success) throw new Error(draft.error);
    expect(draft.created).toBe(true);

    // Attempting generation again returns the SAME draft (duplicate, no new post).
    const again = await generatePostFromOpportunityAction(opportunity.id);
    expect(again.success).toBe(true);
    if (!again.success) throw new Error(again.error);
    expect(again.created).toBe(false);
    expect(again.duplicate).toBe(true);
    expect(again.post.id).toBe(draft.post.id);
    expect(
      userDb.tables.generated_posts!.filter((p) => p.opportunity_id === opportunity.id),
    ).toHaveLength(1);

    // The unapproved draft can never reach LinkedIn.
    const pub = await publishPost(draft.post.id);
    expect(pub.success).toBe(false);
    if (!pub.success) expect(pub.error.code).toBe("INVALID_STATUS");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not invent personal experience — whatIPracticed/whatIBuilt stay honest", async () => {
    // A PDF that only *describes* a course must not fabricate practice/building.
    const pdfBytes = buildTestPdf([
      "Day 1 HTML Basics — this chapter explains and covers semantic tags and accessibility.",
    ]);
    const ingest = await ingestCourseMaterial("honest.pdf", pdfBytes);
    expect(ingest.proposal.journal.whatIPracticed).toBeNull();
    expect(ingest.proposal.journal.whatIBuilt).toBeNull();
    expect(ingest.proposal.journal.confidenceLevel).toBeNull();
    expect(ingest.proposal.missingFields).toContain("whatIPracticed");
    expect(ingest.proposal.missingFields).toContain("whatIBuilt");
  });

  it("cannot schedule an unapproved post", async () => {
    const post = await draftPostFromPdf(
      ["Day 1 HTML Basics — covers semantic HTML."],
      "draft.pdf",
    );
    // Not approved — schedule must be rejected.
    await expect(
      schedulePost({
        post_id: post.id,
        scheduled_at: new Date(Date.now() + 60_000).toISOString(),
      }),
    ).rejects.toMatchObject({ code: "INVALID_STATUS" });
  });
});
