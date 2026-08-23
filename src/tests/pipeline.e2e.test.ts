/**
 * End-to-End Pipeline Integration Test (Phase 3G-D)
 *
 * Exercises the full 3A → 3G-C content pipeline through the REAL service and
 * action code, with only the infrastructure edges faked:
 *   - Supabase: an in-memory client emulating PostgREST query chains + RLS
 *     (owner-scoped reads/writes for user sessions; unrestricted for admin).
 *   - Storage: in-memory bucket for post-images.
 *   - LinkedIn API: mocked global fetch capturing the UGC post request.
 *
 * The AI provider stays the real $0-cost TemplateFallbackProvider (no
 * GEMINI_API_KEY / AI_TEXT_PROVIDER set), so no network calls occur except
 * the captured LinkedIn publish.
 *
 * Flow under test:
 *   journal create → update → submit
 *     → generatePostForDay (fallback provider) → draft persisted
 *     → approvePost
 *     → generatePostImage (SVG → storage → media_assets)
 *     → schedulePost (future) → time-travel to due
 *     → POST /api/scheduler/publish with scheduler secret
 *     → LinkedIn UGC call with author URN from stored linkedin_sub
 *     → schedule published + post published + idempotent second run
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";

vi.hoisted(() => {
  process.env.SCHEDULER_SECRET = process.env.SCHEDULER_SECRET ?? "e2e-scheduler-secret";
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

// ─── In-memory Supabase fake ──────────────────────────────────────────────────

type Row = Record<string, unknown>;

const PROFILE_SCOPED_TABLES = new Set([
  "generated_posts",
  "daily_learning_entries",
  "media_assets",
  "scheduled_posts",
  "linkedin_connections",
]);

type Filter = { col: string; op: "eq" | "lte"; val: unknown };

class FakeQuery {
  private filters: Filter[] = [];
  private selectColumns = "*";
  private selectOpts: { count?: string; head?: boolean } = {};
  private mode: "select" | "insert" | "update" | "delete" | "upsert" | null = null;
  private payload: Row | Row[] | null = null;
  private upsertOpts: { onConflict?: string } = {};
  private wantRowsAfterMutation = false;
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;

  constructor(
    private readonly db: FakeDb,
    private readonly table: string,
  ) {}

  // ── Chain builders ────────────────────────────────────────────────────────

  select(columns?: string, opts?: { count?: string; head?: boolean }): this {
    this.selectColumns = columns ?? "*";
    this.selectOpts = opts ?? {};
    if (this.mode === null) this.mode = "select";
    if (this.mode !== "select") this.wantRowsAfterMutation = true;
    return this;
  }

  eq(col: string, val: unknown): this {
    this.filters.push({ col, op: "eq", val });
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

  single(): Promise<{ data: Row | null; error: { message: string; code: string } | null }> {
    return this.execute().then((res) => {
      const rows = (res.data as Row[]) ?? [];
      if (rows.length === 0) {
        return { data: null, error: { message: "No rows found", code: "PGRST116" } };
      }
      if (rows.length > 1) {
        return { data: rows[0]!, error: { message: "Multiple rows returned", code: "PGRST116" } };
      }
      return { data: rows[0]!, error: null };
    });
  }

  maybeSingle(): Promise<{ data: Row | null; error: null }> {
    return this.execute().then((res) => {
      const rows = (res.data as Row[]) ?? [];
      return { data: rows[0] ?? null, error: null };
    });
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[] | null; count: number | null; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  // ── Execution ─────────────────────────────────────────────────────────────

  private scopedRows(): Row[] {
    let rows = this.db.tables[this.table] ?? [];
    if (this.db.userId !== null && PROFILE_SCOPED_TABLES.has(this.table)) {
      rows = rows.filter((r) => r.profile_id === this.db.userId);
    }
    return rows;
  }

  private applyFilters(rows: Row[]): Row[] {
    let out = rows.filter((row) =>
      this.filters.every(({ col, op, val }) => {
        if (op === "eq") return row[col] === val;
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
    const scopeEnforced = this.db.userId !== null && PROFILE_SCOPED_TABLES.has(this.table);

    if (this.mode === "select") {
      const matched = this.applyFilters(this.scopedRows());
      if (this.selectOpts.head || this.selectOpts.count) {
        return { data: null, count: matched.length, error: null };
      }
      void this.selectColumns; // full rows are always returned by the fake
      return { data: matched, count: matched.length, error: null };
    }

    if (this.mode === "insert") {
      const incoming = Array.isArray(this.payload) ? this.payload : [this.payload!];
      for (const raw of incoming) {
        const row: Row = {
          ...raw,
          id: typeof raw.id === "string" ? raw.id : crypto.randomUUID(),
          // Mirror the real schema defaults the services rely on.
          ...(this.table === "scheduled_posts" ? { attempt_count: raw.attempt_count ?? 0 } : {}),
          created_at: (raw.created_at as string) ?? new Date().toISOString(),
          updated_at: (raw.updated_at as string) ?? new Date().toISOString(),
        };
        if (scopeEnforced) {
          if (row.profile_id !== undefined && row.profile_id !== this.db.userId) {
            return { data: null, count: null, error: { message: "new row violates row-level security policy", code: "42501" } };
          }
          row.profile_id = this.db.userId;
        }
        rows.push(row);
        this.lastInserted = row;
      }
      if (this.wantRowsAfterMutation) {
        return { data: this.lastInserted ? [this.lastInserted] : [], count: null, error: null };
      }
      return { data: null, count: null, error: null };
    }

    if (this.mode === "upsert") {
      const conflictKey = this.upsertOpts.onConflict ?? "id";
      const incoming = Array.isArray(this.payload) ? this.payload : [this.payload!];
      for (const raw of incoming) {
        const existingIdx = rows.findIndex(
          (r) => r[conflictKey] === raw[conflictKey] && (!scopeEnforced || r.profile_id === this.db.userId),
        );
        if (existingIdx >= 0) {
          rows[existingIdx] = { ...rows[existingIdx], ...raw, updated_at: new Date().toISOString() };
        } else {
          rows.push({
            ...raw,
            id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
      return { data: null, count: null, error: null };
    }

    if (this.mode === "update") {
      const target = this.scopedRows();
      const matched = this.applyFilters(target);
      const ids = new Set(matched.map((r) => r.id));
      for (const row of rows) {
        if (ids.has(row.id)) Object.assign(row, this.payload, { updated_at: new Date().toISOString() });
      }
      const updated = (this.db.tables[this.table] ?? []).filter((r) => ids.has(r.id));
      if (this.wantRowsAfterMutation) {
        return { data: updated, count: null, error: null };
      }
      return { data: null, count: null, error: null };
    }

    if (this.mode === "delete") {
      const matched = this.applyFilters(this.scopedRows());
      const ids = new Set(matched.map((r) => r.id));
      this.db.tables[this.table] = rows.filter((r) => !ids.has(r.id));
      return { data: null, count: null, error: null };
    }

    return { data: null, count: null, error: { message: "No operation specified", code: "SYNTAX" } };
  }

  private lastInserted: Row | null = null;
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
            this.files.set(`${bucket}/${path}`, body);
            return { data: { path }, error: null };
          },
          remove: async (paths: string[]) => {
            for (const p of paths) this.files.delete(`${bucket}/${p}`);
            return { data: paths, error: null };
          },
          getPublicUrl: (path: string) => ({
            data: { publicUrl: `https://fake.supabase.co/storage/v1/object/public/${bucket}/${path}` },
          }),
        }),
      },
    };
  }
}

// ─── Fixtures & wiring ────────────────────────────────────────────────────────

const USER_ID = "11111111-1111-4111-8111-111111111111";
const LINKEDIN_SUB = "abc_li_member_sub";
const LINKEDIN_TOKEN = "li-access-token-e2e";
const SCHEDULER_SECRET = process.env.SCHEDULER_SECRET!;

function seedDatabase(db: FakeDb): void {
  db.tables.modules = [
    { id: "mod-1", module_number: 1, title: "Foundations", start_day: 1, end_day: 15 },
  ];
  db.tables.curriculum_days = [
    {
      id: "cd-1",
      day_number: 1,
      module_id: "mod-1",
      week_number: 1,
      topic: "HTML Basics",
      content: "Structure of an HTML document, semantic tags, and accessibility basics.",
      subtopics: ["doctype", "semantic tags"],
      project_information: null,
      assessment_information: null,
    },
  ];
  db.tables.profiles = [{ id: USER_ID, email: "e2e@example.com", created_at: new Date().toISOString() }];
  db.tables.linkedin_connections = [
    {
      id: crypto.randomUUID(),
      profile_id: USER_ID,
      linkedin_sub: LINKEDIN_SUB,
      access_token: LINKEDIN_TOKEN,
      token_type: "bearer",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      scope: "openid profile email w_member_social",
      linkedin_name: "E2E Tester",
      linkedin_email: "e2e@example.com",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  db.tables.daily_learning_entries = [];
  db.tables.generated_posts = [];
  db.tables.scheduled_posts = [];
  db.tables.media_assets = [];
}

let userDb: FakeDb;
let adminDb: FakeDb;
const fetchMock = vi.fn();

import { createClient, createWriteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Real code under test — only infrastructure is faked above.
import {
  createJournalEntry,
  updateJournalEntry,
  submitJournalEntry,
} from "@/services/journal";
import { regeneratePost, approvePost } from "@/app/actions/generated-posts";
import { generatePostImage } from "@/services/image/service";
import { schedulePost } from "@/services/scheduling";
import { POST as schedulerPOST } from "@/app/api/scheduler/publish/route";

beforeEach(() => {
  vi.resetModules();
  userDb = new FakeDb(USER_ID);
  adminDb = new FakeDb(null);
  seedDatabase(userDb);
  // The admin client shares the same database state but bypasses RLS scoping.
  adminDb.tables = userDb.tables;

  (createClient as unknown as Mock).mockResolvedValue(userDb.client());
  (createWriteClient as unknown as Mock).mockResolvedValue(userDb.client());
  (createAdminClient as unknown as Mock).mockReturnValue(adminDb.client());

  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ id: "urn:li:share:E2E123" }),
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── The pipeline ─────────────────────────────────────────────────────────────

describe("End-to-end content pipeline (3A → 3G-C)", () => {
  it("runs journal → generate → approve → image → schedule → cron publish", async () => {
    // ── Phase 2/3B: journal entry lifecycle ────────────────────────────────
    const entry = await createJournalEntry({ day_number: 1 });
    expect(entry.status).toBe("draft");

    await updateJournalEntry(entry.id, {
      what_i_learned: "How semantic HTML improves screen reader navigation.",
      what_i_practiced: "Wrote my first accessible page structure.",
      what_i_built: "A personal profile page in plain HTML.",
      challenge: "Remembering which tags are semantic.",
      how_i_solved_it: "Reviewed MDN and listed them out.",
      key_takeaway: "Semantic HTML is accessibility.",
      tomorrow_focus: "Forms and inputs.",
      confidence_level: 4,
    });

    const submitted = await submitJournalEntry(entry.id);
    expect(submitted.status).toBe("submitted");

    // ── Phase 3D/3E: generation through the server action (fallback provider)
    const genResult = await regeneratePost(1);
    expect(genResult.success).toBe(true);
    if (!genResult.success) throw new Error(genResult.error.message);
    const post = genResult.post;
    expect(post.status).toBe("draft");
    expect(post.provider).toBe("fallback");
    expect(post.model).toBe("template-v1");
    expect(post.opening).toContain("HTML Basics");
    expect(post.hashtags.length).toBeGreaterThan(0);

    // ── Approval gate: draft → approved via the real transition validator ──
    const approved = await approvePost(post.id);
    expect(approved.success).toBe(true);
    expect(approved.success && approved.post.status).toBe("approved");

    // ── Phase 3F: branded SVG image generation → storage → media_assets ────
    const asset = await generatePostImage(post.id);
    expect(asset.generated_post_id).toBe(post.id);
    expect(asset.mime_type).toBe("image/svg+xml");
    expect(userDb.files.has(`post-images/${asset.storage_path}`)).toBe(true);
    const svg = userDb.files.get(`post-images/${asset.storage_path}`)!;
    expect(svg.startsWith("<svg")).toBe(true);

    // ── Phase 3G-C: schedule the approved post for the near future ─────────
    const future = new Date(Date.now() + 60_000).toISOString();
    const schedule = await schedulePost({ post_id: post.id, scheduled_at: future });
    expect(schedule.status).toBe("scheduled");

    // Time-travel: make the schedule due.
    (schedule.scheduled_at as string) = new Date(Date.now() - 1000).toISOString();

    // ── Cron publisher: secret-protected route → LinkedIn UGC Posts API ────
    const request = new Request("http://localhost/api/scheduler/publish", {
      method: "POST",
      headers: { authorization: `Bearer ${SCHEDULER_SECRET}` },
    });
    const response = await schedulerPOST(request);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      processed: number;
      results: Array<{ status: string; postId: string }>;
    };
    expect(body.processed).toBe(1);
    expect(body.results[0]!.status).toBe("published");
    expect(body.results[0]!.postId).toBe(post.id);

    // The author URN must come from the stored OpenID Connect subject.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.linkedin.com/v2/ugcPosts");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${LINKEDIN_TOKEN}`);
    const payloadBody = JSON.parse(init.body as string) as {
      author: string;
      specificContent: { "com.linkedin.ugc.ShareContent": { shareCommentary: { text: string } } };
    };
    expect(payloadBody.author).toBe(`urn:li:person:${LINKEDIN_SUB}`);
    expect(payloadBody.specificContent["com.linkedin.ugc.ShareContent"].shareCommentary.text).toContain(
      "HTML Basics",
    );

    // Final database state: schedule + post both published with the LinkedIn id.
    const finalSchedule = userDb.tables.scheduled_posts![0]!;
    expect(finalSchedule.status).toBe("published");
    expect(finalSchedule.linkedin_post_id).toBe("urn:li:share:E2E123");
    expect(finalSchedule.published_at).toBeTruthy();
    expect(finalSchedule.attempt_count).toBe(1);
    expect(finalSchedule.last_error).toBeNull();

    const finalPost = userDb.tables.generated_posts!.find((r) => r.id === post.id)!;
    expect(finalPost.status).toBe("published");
    expect(finalPost.linkedin_post_id).toBe("urn:li:share:E2E123");
    expect(finalPost.published_at).toBeTruthy();
    expect(finalPost.publish_error).toBeNull();
  });

  it("does not republish on a second cron run after success", async () => {
    await createJournalEntry({ day_number: 1 }).then(async (entry) => {
      await updateJournalEntry(entry.id, { what_i_learned: "Something worth sharing today." });
      await submitJournalEntry(entry.id);
    });
    const genResult = await regeneratePost(1);
    if (!genResult.success) throw new Error(genResult.error.message);
    await approvePost(genResult.post.id);
    const schedule = await schedulePost({
      post_id: genResult.post.id,
      scheduled_at: new Date(Date.now() + 60_000).toISOString(),
    });
    (schedule.scheduled_at as string) = new Date(Date.now() - 1000).toISOString();

    const first = await schedulerPOST(      new Request("http://localhost/api/scheduler/publish", {
        method: "POST",
        headers: { authorization: `Bearer ${SCHEDULER_SECRET}` },
      }),
    );
    expect(((await first.json()) as { processed: number }).processed).toBe(1);

    // Second run: nothing due anymore — no duplicate LinkedIn publication.
    const second = await schedulerPOST(
      new Request("http://localhost/api/scheduler/publish", {
        method: "POST",
        headers: { authorization: `Bearer ${SCHEDULER_SECRET}` },
      }),
    );
    const body = (await second.json()) as { processed: number };
    expect(body.processed).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects the cron endpoint without the scheduler secret", async () => {
    const res = await schedulerPOST(
      new Request("http://localhost/api/scheduler/publish", { method: "POST" }),
    );
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
