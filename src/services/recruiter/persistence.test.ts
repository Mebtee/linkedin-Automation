import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/services/course-materials", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/course-materials")>();
  return {
    ...actual,
    getOwnCourseMaterial: (...a: unknown[]) => mockGetOwnCourseMaterial(...a),
  };
});

const mockGetOwnCourseMaterial = vi.fn();

import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/utils/errors";
import type { ContentOpportunityRow } from "@/types/content-opportunity";
import type { CreateContentOpportunityInput } from "@/types/content-opportunity";
import {
  createContentOpportunities,
  createContentOpportunity,
  deleteContentOpportunity,
  getContentOpportunity,
  listContentOpportunities,
  updateContentOpportunityStatus,
} from "./persistence";
import {
  generateContentOpportunitiesForCourseMaterial,
  generateContentOpportunitiesForDay,
  selectBestContentOpportunity,
} from "./index";

// ─── Supabase mock ───────────────────────────────────────────────────────────
// One self-referential thenable query chain. Builder methods (select/eq/in/
// order/limit/insert/upsert/update/delete) return the same chain; awaiting any
// of them resolves the *current* `state.result`. Tests swap `state.result`
// between steps to mimic sequential queries.

type Result = { data: unknown; error: unknown };
type QueryChain = {
  select: Mock;
  eq: Mock;
  in: Mock;
  order: Mock;
  limit: Mock;
  insert: Mock;
  upsert: Mock;
  update: Mock;
  delete: Mock;
  single: Mock;
  then?: (onFulfilled?: (v: Result) => unknown, onRejected?: (e: unknown) => unknown) => Promise<unknown>;
  catch?: (onRejected?: (e: unknown) => unknown) => Promise<unknown>;
};

function buildClient(getUser: () => unknown, initial: Result) {
  const state = { result: initial };

  const chain = {} as QueryChain &
    Record<string, Mock | ((onFulfilled?: unknown, onRejected?: unknown) => Promise<unknown>)>;
  for (const name of [
    "select",
    "eq",
    "in",
    "order",
    "limit",
    "insert",
    "upsert",
    "update",
    "delete",
  ]) {
    (chain as Record<string, unknown>)[name] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockImplementation(() => Promise.resolve(state.result));
  chain.then = (onFulfilled?: (v: Result) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(state.result).then(onFulfilled, onRejected);
  chain.catch = (onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(state.result).catch(onRejected);

  const supabase = {
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: getUser() }, error: null })),
    },
    from: vi.fn().mockReturnValue(chain),
  };

  return { supabase, chain, state };
}

const mockCreateClient = createClient as unknown as Mock;

function ok(data: unknown): Result {
  return { data, error: null };
}

function dbError(message = "database boom"): Result {
  return { data: null, error: { message, code: "22P02" } };
}

const loggedInUser = { id: "user-1", email: "u@e.com" };

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<ContentOpportunityRow> = {}): ContentOpportunityRow {
  return {
    id: "op-1",
    profile_id: "user-1",
    source_type: "journal",
    source_id: "entry-1",
    day_number: 12,
    module_number: null,
    post_type: "TECHNICAL_LESSON",
    content_goal: "GET_RECRUITER_ATTENTION",
    title: "Understanding Row Level Security",
    summary: null,
    evidence: [{ field: "whatILearned", pageNumbers: [4], confidence: "SUPPORTED_BY_PDF" }],
    recruiter_score: 62,
    recruiter_score_breakdown: {
      total: 62,
      dimensions: {
        realImplementationEvidence: 0,
        problemSolvingEvidence: 0,
        technicalDepth: 15,
        productionDeploymentRelevance: 0,
        securityEngineeringQuality: 0,
        multipleSkills: 20,
        communicationTeachingValue: 5,
        uniqueness: 5,
      },
      eligible: true,
      authenticityFlags: [],
    },
    selection_reason: null,
    status: "candidate",
    dedup_key: "a".repeat(24),
    created_at: "2026-08-27T10:00:00Z",
    updated_at: "2026-08-27T10:00:00Z",
    ...overrides,
  };
}

function makeBaseCreateInput(): CreateContentOpportunityInput {
  return {
    source_type: "journal",
    source_id: "entry-1",
    day_number: 12,
    module_number: null,
    post_type: "TECHNICAL_LESSON",
    content_goal: "GET_RECRUITER_ATTENTION",
    title: "Understanding Row Level Security",
    summary: null,
    evidence: [{ field: "whatILearned", pageNumbers: [4], confidence: "SUPPORTED_BY_PDF" }],
    recruiter_score: 62,
    recruiter_score_breakdown: null,
    selection_reason: null,
    status: "candidate",
    dedup_key: "a".repeat(24),
  };
}

function submittedEntry() {
  return ok({
    id: "entry-1",
    profile_id: "user-1",
    day_number: 12,
    status: "submitted",
    what_i_learned: "Row Level Security restricts rows by the profile id.",
    what_i_practiced: null,
    what_i_built: "Built a tenant-scoped todos API.",
    challenge: null,
    how_i_solved_it: null,
    key_takeaway: null,
    tomorrow_focus: null,
    project_name: null,
    project_description: null,
    code_reference: null,
    resources_used: null,
    confidence_level: 4,
    additional_notes: null,
  });
}

// ─── Persistence tests ───────────────────────────────────────────────────────

describe("Phase 5B — content opportunity persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires authentication for writes", async () => {
    const { supabase } = buildClient(() => null, ok([]));
    mockCreateClient.mockResolvedValue(supabase);

    await expect(createContentOpportunities([makeBaseCreateInput()])).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
    });
  });

  it("batch-creates via upsert keyed on (profile_id, dedup_key), skipping existing rows", async () => {
    const rows = [makeRow({ id: "op-1" }), makeRow({ id: "op-2", post_type: "LEARNING_MILESTONE" })];
    const { supabase, chain, state } = buildClient(() => loggedInUser, ok(null));
    mockCreateClient.mockResolvedValue(supabase);
    state.result = ok(rows);

    const created = await createContentOpportunities([makeBaseCreateInput(), makeBaseCreateInput()]);

    expect(created).toEqual(rows);
    expect(supabase.from).toHaveBeenCalledWith("content_opportunities");
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ profile_id: "user-1", dedup_key: "a".repeat(24) }),
      ]),
      { onConflict: "profile_id,dedup_key", ignoreDuplicates: true },
    );
  });

  it("rejects invalid post types before touching the database", async () => {
    const { supabase, chain } = buildClient(() => loggedInUser, ok([]));
    mockCreateClient.mockResolvedValue(supabase);

    const bad = { ...makeBaseCreateInput(), post_type: "NOT_A_TYPE" } as unknown as CreateContentOpportunityInput;
    await expect(createContentOpportunities([bad])).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(chain.upsert).not.toHaveBeenCalled();
  });

  it("fails cleanly when the database rejects a single insert", async () => {
    const { supabase } = buildClient(() => loggedInUser, dbError("duplicate key"));
    mockCreateClient.mockResolvedValue(supabase);

    await expect(createContentOpportunity(makeBaseCreateInput())).rejects.toMatchObject({
      code: "DATABASE_ERROR",
    });
  });

  it("lists only the owner's opportunities, scored highest first", async () => {
    const rows = [makeRow(), makeRow({ id: "op-2", recruiter_score: 10 })];
    const { supabase, chain, state } = buildClient(() => loggedInUser, ok([]));
    mockCreateClient.mockResolvedValue(supabase);
    state.result = ok(rows);

    const result = await listContentOpportunities({ status: "candidate" });

    expect(result).toEqual(rows);
    expect(supabase.from).toHaveBeenCalledWith("content_opportunities");
    expect(chain.order).toHaveBeenCalledWith("recruiter_score", { ascending: false });
  });

  it("returns an empty list for anonymous sessions (no data leak)", async () => {
    const { supabase } = buildClient(() => null, ok([makeRow()]));
    mockCreateClient.mockResolvedValue(supabase);

    await expect(listContentOpportunities()).resolves.toEqual([]);
  });

  it("returns null for a missing or foreign opportunity", async () => {
    const { supabase } = buildClient(() => loggedInUser, dbError("not found"));
    mockCreateClient.mockResolvedValue(supabase);

    await expect(getContentOpportunity("op-unknown")).resolves.toBeNull();
  });

  it("allows candidate → selected and stores the public reason", async () => {
    const updated = makeRow({ status: "selected", selection_reason: "Recommended because…" });
    const { supabase, chain, state } = buildClient(() => loggedInUser, ok(null));
    mockCreateClient.mockResolvedValue(supabase);
    // loadOwnOpportunity (single #1) sees the current candidate row first…
    chain.single.mockReturnValueOnce(Promise.resolve(ok(makeRow())));
    // …then the update's .single() resolves with the changed row.
    state.result = ok(updated);

    const result = await updateContentOpportunityStatus("op-1", "selected", "Recommended because…");

    expect(result.status).toBe("selected");
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "selected", selection_reason: "Recommended because…" }),
    );
  });

  it("rejects illegal transitions (candidate → published)", async () => {
    const { supabase, state } = buildClient(() => loggedInUser, ok(null));
    mockCreateClient.mockResolvedValue(supabase);
    state.result = ok(makeRow());

    await expect(updateContentOpportunityStatus("op-1", "published")).rejects.toMatchObject({
      code: "INVALID_STATUS",
    });
  });

  it("cannot delete a published opportunity", async () => {
    const { supabase, state } = buildClient(() => loggedInUser, ok(null));
    mockCreateClient.mockResolvedValue(supabase);
    state.result = ok(makeRow({ status: "published" }));

    await expect(deleteContentOpportunity("op-1")).rejects.toMatchObject({
      code: "INVALID_STATUS",
    });
  });

  it("deletes a candidate owner-scoped", async () => {
    const { supabase, chain, state } = buildClient(() => loggedInUser, ok(null));
    mockCreateClient.mockResolvedValue(supabase);
    state.result = ok(makeRow());

    await deleteContentOpportunity("op-1");
    expect(chain.delete).toHaveBeenCalled();
  });
});

// ─── Orchestration tests ─────────────────────────────────────────────────────

function journalFixture(): ReturnType<typeof buildClient> {
  const client = buildClient(() => loggedInUser, ok(null));
  mockCreateClient.mockResolvedValue(client.supabase);

  const seq: readonly Result[] = [submittedEntry(), ok({ topic: "Row Level Security", module_id: "m1" })];
  for (const result of seq) {
    client.chain.single.mockReturnValueOnce(Promise.resolve(result));
  }
  return client;
}

describe("Phase 5B — orchestration entry points", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds and persists opportunities for a submitted journal entry", async () => {
    const client = journalFixture();
    const rows = [makeRow(), makeRow({ id: "op-2", post_type: "PROJECT_SHOWCASE" })];
    client.state.result = ok(rows);

    const result = await generateContentOpportunitiesForDay({ dayNumber: 12 });

    expect(result.length).toBeGreaterThan(0);
    // Confirmed journal evidence can feed a project showcase.
    expect(result.some((r) => r.post_type === "PROJECT_SHOWCASE")).toBe(true);
  });

  it("rejects an invalid day number before querying", async () => {
    const { supabase } = buildClient(() => loggedInUser, ok(null));
    mockCreateClient.mockResolvedValue(supabase);

    await expect(generateContentOpportunitiesForDay({ dayNumber: 999 })).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it("is a no-op when the journal entry is empty", async () => {
    const client = journalFixture();
    client.chain.single.mockReset();
    client.chain.single
      .mockReturnValueOnce(Promise.resolve(ok({ ...(submittedEntry().data as object), what_i_learned: null, what_i_built: null, key_takeaway: null, tomorrow_focus: null })))
      .mockReturnValueOnce(Promise.resolve(ok({ topic: "Row Level Security", module_id: "m1" })));

    const result = await generateContentOpportunitiesForDay({ dayNumber: 12 });

    expect(result).toEqual([]);
  });

  it("generates learning-only opportunities from a course-material proposal", async () => {
    mockGetOwnCourseMaterial.mockResolvedValue({
      id: "document-1",
      profile_id: "user-1",
      journal_proposal: {
        curriculumDay: 12,
        moduleNumber: 2,
        moduleTitle: "Database Security",
        topic: "Supabase Row Level Security",
        journal: {
          whatILearned: "Students learn to secure tenant data with row level security policies.",
          whatIBuilt: "Students will build a todos API with Supabase.",
        },
        evidence: [
          { field: "whatILearned", sourceType: "pdf", pageNumbers: [4], confidence: "SUPPORTED_BY_PDF" },
          { field: "whatIBuilt", sourceType: "pdf", pageNumbers: [5], confidence: "SUPPORTED_BY_PDF" },
        ],
      },
    });

    const client = buildClient(() => loggedInUser, ok(null));
    mockCreateClient.mockResolvedValue(client.supabase);
    client.state.result = ok([makeRow()]);

    const result = await generateContentOpportunitiesForCourseMaterial({
      courseMaterialId: "document-1",
    });

    expect(result.every((r) => r.post_type === "TECHNICAL_LESSON")).toBe(true);
    expect(result.some((r) => r.post_type === "PROJECT_SHOWCASE")).toBe(false);
  });

  it("errors when the course material has no proposal yet", async () => {
    mockGetOwnCourseMaterial.mockResolvedValue({
      id: "document-1",
      profile_id: "user-1",
      journal_proposal: null,
    });
    const { supabase } = buildClient(() => loggedInUser, ok([]));
    mockCreateClient.mockResolvedValue(supabase);

    await expect(
      generateContentOpportunitiesForCourseMaterial({ courseMaterialId: "document-1" }),
    ).rejects.toMatchObject({ code: "PROPOSAL_NOT_READY" });
  });

  it("selects the strongest eligible stored opportunity without re-scoring", async () => {
    const weak = makeRow({
      id: "weak",
      recruiter_score: 10,
      post_type: "TECHNICAL_LESSON",
      recruiter_score_breakdown: { ...makeRow().recruiter_score_breakdown!, total: 10 },
    });
    const strong = makeRow({
      id: "strong",
      recruiter_score: 90,
      post_type: "PROJECT_SHOWCASE",
      status: "selected",
      recruiter_score_breakdown: { ...makeRow().recruiter_score_breakdown!, total: 90 },
    });

    const client = buildClient(() => loggedInUser, ok(null));
    mockCreateClient.mockResolvedValue(client.supabase);
    client.state.result = ok([weak, strong]);

    const result = await selectBestContentOpportunity();

    expect(result).not.toBeNull();
    expect(result!.row.id).toBe("strong");
    expect(result!.reason).toMatch(/^Recommended because/);
    // Already selected → no unnecessary write.
    expect(client.chain.update).not.toHaveBeenCalled();
  });

  it("returns null when every candidate fails the authenticity gates", async () => {
    const flagged = makeRow({
      id: "bad",
      recruiter_score: 88,
      recruiter_score_breakdown: {
        ...makeRow().recruiter_score_breakdown!,
        eligible: false,
        authenticityFlags: ["Personal claims require confirmed evidence."],
      },
    });

    const client = buildClient(() => loggedInUser, ok(null));
    mockCreateClient.mockResolvedValue(client.supabase);
    client.state.result = ok([flagged]);

    const result = await selectBestContentOpportunity();

    expect(result).toBeNull();
    expect(client.chain.update).not.toHaveBeenCalled();
  });
});