import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// Casts a partial mock into the client type the service functions accept.
function asAdmin(client: unknown): SupabaseClient {
  return client as unknown as SupabaseClient;
}

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import {
  schedulePost,
  cancelSchedule,
  reschedulePost,
  getActiveSchedule,
  findDueScheduledPosts,
  claimScheduledPost,
  markSchedulePublished,
  markScheduleFailed,
  loadPostForPublishing,
  listUserSchedules,
} from "./index";
import { createClient } from "@/lib/supabase/server";
import { canTransition } from "@/types/schedule";
import type { ScheduledPostRow, ScheduleStatus } from "@/types/schedule";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeSchedule(
  overrides: Partial<ScheduledPostRow> = {},
): ScheduledPostRow {
  return {
    id: "sched-1",
    post_id: "post-1",
    profile_id: "user-1",
    scheduled_at: futureDate(),
    status: "scheduled",
    published_at: null,
    linkedin_post_id: null,
    last_error: null,
    attempt_count: 0,
    created_at: "2026-08-20T10:00:00Z",
    updated_at: "2026-08-20T10:00:00Z",
    ...overrides,
  };
}

function futureDate(ms = 3600000): string {
  return new Date(Date.now() + ms).toISOString();
}

function pastDate(): string {
  return new Date(Date.now() - 3600000).toISOString();
}

type Result = { data: unknown; error: unknown };

type ResultHandler = (value: Result) => unknown;
type ErrorHandler = (error: unknown) => unknown;

type QueryChain = {
  select: Mock;
  eq: Mock;
  insert: Mock;
  update: Mock;
  order: Mock;
  limit: Mock;
  lte: Mock;
  maybeSingle: Mock;
  single: Mock;
  then: (onFulfilled?: ResultHandler, onRejected?: ErrorHandler) => Promise<unknown>;
  catch: (onRejected?: ErrorHandler) => Promise<unknown>;
};

function buildChain(result: Result): QueryChain {
  const resultPromise = Promise.resolve(result);
  const terminal = vi.fn().mockResolvedValue(result);

  // One self-referential thenable object: builder methods return the same
  // chain, and awaiting the chain resolves with the queued result.
  const chain = {} as Record<string, unknown>;

  for (const name of [
    "select",
    "eq",
    "insert",
    "update",
    "order",
    "limit",
    "lte",
    "in",
  ]) {
    chain[name] = vi.fn().mockReturnValue(chain);
  }
  chain.maybeSingle = terminal;
  chain.single = terminal;

  chain.then = (
    onFulfilled?: ResultHandler,
    onRejected?: ErrorHandler,
  ) => resultPromise.then(onFulfilled, onRejected);
  chain.catch = (onRejected?: ErrorHandler) =>
    resultPromise.catch(onRejected);

  return chain as unknown as QueryChain;
}

function ok(data: unknown): Result {
  return { data, error: null };
}

function dbError(message: string): Result {
  return { data: null, error: { message, code: "DB_ERROR" } };
}

function buildSupabase(
  tableResponses: Record<string, Result[]>,
) {
  const queues: Record<string, Result[]> = {};
  for (const [table, results] of Object.entries(tableResponses)) {
    queues[table] = [...results];
  }

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
      }),
    },
    from: vi.fn((table: string) => {
      const queue = queues[table];
      if (!queue || queue.length === 0) {
        throw new Error(`No mock response queued for table "${table}"`);
      }
      const result = queue.shift()!;
      return buildChain(result);
    }),
  };

  return {
    supabase,
    from: supabase.from as Mock,
    getUser: supabase.auth.getUser as Mock,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("schedulePost", () => {
  let mock: ReturnType<typeof buildSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    mock = buildSupabase({
      generated_posts: [ok({ id: "post-1", status: "approved" })],
      scheduled_posts: [ok(null), ok(makeSchedule())],
    });
    (createClient as Mock).mockResolvedValue(mock.supabase);
  });

  it("schedules an approved post successfully", async () => {
    const result = await schedulePost({
      post_id: "post-1",
      scheduled_at: futureDate(),
    });

    expect(result.id).toBe("sched-1");
    expect(result.status).toBe("scheduled");
    expect(mock.from).toHaveBeenCalledWith("generated_posts");
    expect(mock.from).toHaveBeenCalledWith("scheduled_posts");
  });

  it("rejects a draft post", async () => {
    mock = buildSupabase({
      generated_posts: [ok({ id: "post-1", status: "draft" })],
      scheduled_posts: [],
    });
    (createClient as Mock).mockResolvedValue(mock.supabase);

    await expect(
      schedulePost({ post_id: "post-1", scheduled_at: futureDate() }),
    ).rejects.toThrow("Only approved posts can be scheduled");
  });

  it("rejects a failed post", async () => {
    mock = buildSupabase({
      generated_posts: [ok({ id: "post-1", status: "failed" })],
      scheduled_posts: [],
    });
    (createClient as Mock).mockResolvedValue(mock.supabase);

    await expect(
      schedulePost({ post_id: "post-1", scheduled_at: futureDate() }),
    ).rejects.toThrow("Only approved posts can be scheduled");
  });

  it("rejects a published post", async () => {
    mock = buildSupabase({
      generated_posts: [ok({ id: "post-1", status: "published" })],
      scheduled_posts: [],
    });
    (createClient as Mock).mockResolvedValue(mock.supabase);

    await expect(
      schedulePost({ post_id: "post-1", scheduled_at: futureDate() }),
    ).rejects.toThrow("Only approved posts can be scheduled");
  });

  it("rejects past schedule time", async () => {
    await expect(
      schedulePost({ post_id: "post-1", scheduled_at: pastDate() }),
    ).rejects.toThrow("Schedule time must be in the future");
  });

  it("rejects duplicate active schedule", async () => {
    mock = buildSupabase({
      generated_posts: [ok({ id: "post-1", status: "approved" })],
      scheduled_posts: [ok({ id: "existing-sched" })],
    });
    (createClient as Mock).mockResolvedValue(mock.supabase);

    await expect(
      schedulePost({ post_id: "post-1", scheduled_at: futureDate() }),
    ).rejects.toThrow("already has an active schedule");
  });

  it("throws when post not found", async () => {
    mock = buildSupabase({
      generated_posts: [dbError("Not found")],
      scheduled_posts: [],
    });
    (createClient as Mock).mockResolvedValue(mock.supabase);

    await expect(
      schedulePost({ post_id: "nonexistent", scheduled_at: futureDate() }),
    ).rejects.toThrow("Generated post not found");
  });

  it("throws when not authenticated", async () => {
    mock = buildSupabase({
      generated_posts: [],
      scheduled_posts: [],
    });
    mock.getUser.mockResolvedValue({ data: { user: null } });
    (createClient as Mock).mockResolvedValue(mock.supabase);

    await expect(
      schedulePost({ post_id: "post-1", scheduled_at: futureDate() }),
    ).rejects.toThrow("Authentication required");
  });
});

describe("cancelSchedule", () => {
  let mock: ReturnType<typeof buildSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancels a scheduled post", async () => {
    mock = buildSupabase({
      scheduled_posts: [
        ok(makeSchedule({ status: "cancelled" })),
      ],
    });
    (createClient as Mock).mockResolvedValue(mock.supabase);

    const result = await cancelSchedule("sched-1");
    expect(result.status).toBe("cancelled");
  });

  it("rejects cancelling when no cancellable row matches (published/claimed/foreign)", async () => {
    // Zero rows match the guarded UPDATE → .single() errors.
    mock = buildSupabase({
      scheduled_posts: [dbError("No rows")],
    });
    (createClient as Mock).mockResolvedValue(mock.supabase);

    await expect(cancelSchedule("sched-1")).rejects.toThrow(
      "no longer cancellable",
    );
  });

  it("rejects non-existent schedule", async () => {
    mock = buildSupabase({
      scheduled_posts: [dbError("Not found")],
    });
    (createClient as Mock).mockResolvedValue(mock.supabase);

    await expect(cancelSchedule("nonexistent")).rejects.toThrow(
      "not found or is no longer cancellable",
    );
  });
});

describe("reschedulePost", () => {
  let mock: ReturnType<typeof buildSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reschedules to a new future time", async () => {
    mock = buildSupabase({
      scheduled_posts: [
        ok(makeSchedule({ id: "sched-1", post_id: "post-1", status: "scheduled" })),
        ok(makeSchedule({ id: "sched-1", post_id: "post-1", status: "cancelled" })),
        ok(makeSchedule({ id: "sched-2", post_id: "post-1", scheduled_at: futureDate(7200000) })),
      ],
    });
    (createClient as Mock).mockResolvedValue(mock.supabase);

    const result = await reschedulePost("sched-1", futureDate(7200000));
    expect(result.id).toBe("sched-2");
    expect(result.status).toBe("scheduled");
  });

  it("aborts when the schedule was claimed by the publisher mid-reschedule", async () => {
    // Cancel step matches zero rows because the cron claimed it first.
    mock = buildSupabase({
      scheduled_posts: [
        ok(makeSchedule({ id: "sched-1", status: "scheduled" })),
        dbError("Zero rows updated"),
      ],
    });
    (createClient as Mock).mockResolvedValue(mock.supabase);

    await expect(
      reschedulePost("sched-1", futureDate(7200000)),
    ).rejects.toThrow("no longer active");
  });

  it("rejects past schedule time", async () => {
    mock = buildSupabase({
      scheduled_posts: [
        ok(makeSchedule({ status: "scheduled" })),
      ],
    });
    (createClient as Mock).mockResolvedValue(mock.supabase);

    await expect(
      reschedulePost("sched-1", pastDate()),
    ).rejects.toThrow("Schedule time must be in the future");
  });

  it("rejects rescheduling a non-scheduled status", async () => {
    mock = buildSupabase({
      scheduled_posts: [
        ok(makeSchedule({ status: "published" })),
      ],
    });
    (createClient as Mock).mockResolvedValue(mock.supabase);

    await expect(
      reschedulePost("sched-1", futureDate()),
    ).rejects.toThrow("Only scheduled posts can be rescheduled");
  });

  it("rejects non-existent schedule", async () => {
    mock = buildSupabase({
      scheduled_posts: [dbError("Not found")],
    });
    (createClient as Mock).mockResolvedValue(mock.supabase);

    await expect(
      reschedulePost("nonexistent", futureDate()),
    ).rejects.toThrow("Schedule not found");
  });
});

describe("getActiveSchedule", () => {
  let mock: ReturnType<typeof buildSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns active schedule for a post", async () => {
    mock = buildSupabase({
      scheduled_posts: [ok(makeSchedule())],
    });
    (createClient as Mock).mockResolvedValue(mock.supabase);

    const result = await getActiveSchedule("post-1");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("sched-1");
  });

  it("returns null when no active schedule exists", async () => {
    mock = buildSupabase({
      scheduled_posts: [ok(null)],
    });
    (createClient as Mock).mockResolvedValue(mock.supabase);

    const result = await getActiveSchedule("post-no-schedule");
    expect(result).toBeNull();
  });
});

describe("findDueScheduledPosts", () => {
  let adminSupabase: { from: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    adminSupabase = { from: vi.fn() };
  });

  it("returns due posts when scheduled_at <= now", async () => {
    adminSupabase.from.mockReturnValue(
      buildChain(ok([makeSchedule({ id: "sched-1" }), makeSchedule({ id: "sched-2" })])),
    );

    const result = await findDueScheduledPosts(asAdmin(adminSupabase), 10);

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("sched-1");
    expect(result[1]?.id).toBe("sched-2");
  });

  it("returns empty array when no due posts", async () => {
    adminSupabase.from.mockReturnValue(buildChain(ok([])));

    const result = await findDueScheduledPosts(asAdmin(adminSupabase), 10);

    expect(result).toEqual([]);
  });

  it("uses default batch size of 10", async () => {
    const chain = buildChain(ok([]));
    adminSupabase.from.mockReturnValue(chain);

    await findDueScheduledPosts(asAdmin(adminSupabase));

    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  it("respects custom batch size", async () => {
    const chain = buildChain(ok([]));
    adminSupabase.from.mockReturnValue(chain);

    await findDueScheduledPosts(asAdmin(adminSupabase), 5);

    expect(chain.limit).toHaveBeenCalledWith(5);
  });

  it("throws on database error", async () => {
    adminSupabase.from.mockReturnValue(buildChain(dbError("DB error")));

    await expect(
      findDueScheduledPosts(asAdmin(adminSupabase)),
    ).rejects.toThrow("Failed to fetch due scheduled posts");
  });
});

describe("claimScheduledPost", () => {
  let adminSupabase: { from: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    adminSupabase = { from: vi.fn() };
  });

  it("claims a scheduled post successfully", async () => {
    const chain = buildChain(ok(makeSchedule({ status: "publishing" })));
    adminSupabase.from.mockReturnValue(chain);

    const result = await claimScheduledPost(asAdmin(adminSupabase), "sched-1", 1);

    expect(result).not.toBeNull();
    expect(result?.status).toBe("publishing");
    // Atomic conditional claim: guarded on current status.
    expect(chain.update).toHaveBeenCalledWith({
      status: "publishing",
      attempt_count: 1,
    });
    expect(chain.eq).toHaveBeenCalledWith("id", "sched-1");
    expect(chain.eq).toHaveBeenCalledWith("status", "scheduled");
  });

  it("increments attempt count on retry claims", async () => {
    const chain = buildChain(ok(makeSchedule({ status: "publishing", attempt_count: 2 })));
    adminSupabase.from.mockReturnValue(chain);

    await claimScheduledPost(asAdmin(adminSupabase), "sched-1", 2);

    expect(chain.update).toHaveBeenCalledWith({
      status: "publishing",
      attempt_count: 2,
    });
  });

  it("returns null if already claimed (duplicate claim prevention)", async () => {
    const chain = buildChain(ok(null));
    adminSupabase.from.mockReturnValue(chain);

    const result = await claimScheduledPost(asAdmin(adminSupabase), "sched-1", 1);

    expect(result).toBeNull();
  });

  it("returns null when update errors (row no longer 'scheduled')", async () => {
    adminSupabase.from.mockReturnValue(buildChain(dbError("PGRST116")));

    const result = await claimScheduledPost(asAdmin(adminSupabase), "sched-1", 1);

    expect(result).toBeNull();
  });
});

describe("markSchedulePublished", () => {
  let adminSupabase: { from: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    adminSupabase = { from: vi.fn() };
  });

  it("marks schedule as published with linkedin post id", async () => {
    const chain = buildChain(ok(null));
    adminSupabase.from.mockReturnValue(chain);

    await markSchedulePublished(
      asAdmin(adminSupabase),
      "sched-1",
      "urn:li:share:12345",
    );

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "published",
        linkedin_post_id: "urn:li:share:12345",
        published_at: expect.any(String),
      }),
    );
    expect(chain.eq).toHaveBeenCalledWith("id", "sched-1");
    // Guarded on 'publishing' — an already-published/failed row never changes.
    expect(chain.eq).toHaveBeenCalledWith("status", "publishing");
  });

  it("throws on database error", async () => {
    adminSupabase.from.mockReturnValue(buildChain(dbError("DB error")));

    await expect(
      markSchedulePublished(asAdmin(adminSupabase), "sched-1", "urn:li:share:12345"),
    ).rejects.toThrow("Failed to mark schedule as published");
  });
});

describe("markScheduleFailed", () => {
  let adminSupabase: { from: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    adminSupabase = { from: vi.fn() };
  });

  it("marks schedule as failed with error message", async () => {
    const chain = buildChain(ok(null));
    adminSupabase.from.mockReturnValue(chain);

    await markScheduleFailed(
      asAdmin(adminSupabase),
      "sched-1",
      "LinkedIn API timeout",
    );

    expect(chain.update).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("id", "sched-1");
    expect(chain.eq).toHaveBeenCalledWith("status", "publishing");
  });

  it("throws on database error", async () => {
    adminSupabase.from.mockReturnValue(buildChain(dbError("DB error")));

    await expect(
      markScheduleFailed(asAdmin(adminSupabase), "sched-1", "Some error"),
    ).rejects.toThrow("Failed to mark schedule as failed");
  });
});

describe("listUserSchedules", () => {
  let mock: ReturnType<typeof buildSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns schedules merged with their linked posts", async () => {
    mock = buildSupabase({
      scheduled_posts: [
        ok([makeSchedule({ id: "sched-1", post_id: "post-1" })]),
      ],
      generated_posts: [
        ok([
          {
            id: "post-1",
            day_number: 12,
            opening: "Built a REST API with authentication",
            status: "approved",
          },
        ]),
      ],
    });
    (createClient as Mock).mockResolvedValue(mock.supabase);

    const result = await listUserSchedules();

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("sched-1");
    expect(result[0]?.post).toEqual({
      id: "post-1",
      day_number: 12,
      opening: "Built a REST API with authentication",
      status: "approved",
    });
    expect(mock.from).toHaveBeenCalledWith("scheduled_posts");
    expect(mock.from).toHaveBeenCalledWith("generated_posts");
  });

  it("returns empty array when nothing is scheduled", async () => {
    mock = buildSupabase({
      scheduled_posts: [ok([])],
      generated_posts: [],
    });
    (createClient as Mock).mockResolvedValue(mock.supabase);

    const result = await listUserSchedules();

    expect(result).toEqual([]);
    expect(mock.from).toHaveBeenCalledTimes(1);
  });

  it("keeps a schedule whose post is missing (defensive)", async () => {
    mock = buildSupabase({
      scheduled_posts: [ok([makeSchedule({ id: "sched-1" })])],
      generated_posts: [ok([])],
    });
    (createClient as Mock).mockResolvedValue(mock.supabase);

    const result = await listUserSchedules();

    expect(result).toHaveLength(1);
    expect(result[0]?.post).toBeNull();
  });

  it("throws when the schedule query fails", async () => {
    mock = buildSupabase({
      scheduled_posts: [dbError("DB down")],
      generated_posts: [],
    });
    (createClient as Mock).mockResolvedValue(mock.supabase);

    await expect(listUserSchedules()).rejects.toThrow(
      "Failed to fetch scheduled posts",
    );
  });

  it("throws when the post query fails", async () => {
    mock = buildSupabase({
      scheduled_posts: [ok([makeSchedule({ id: "sched-1" })])],
      generated_posts: [dbError("DB down")],
    });
    (createClient as Mock).mockResolvedValue(mock.supabase);

    await expect(listUserSchedules()).rejects.toThrow(
      "Failed to fetch scheduled post details",
    );
  });

  it("throws when not authenticated", async () => {
    mock = buildSupabase({
      scheduled_posts: [],
      generated_posts: [],
    });
    mock.getUser.mockResolvedValue({ data: { user: null } });
    (createClient as Mock).mockResolvedValue(mock.supabase);

    await expect(listUserSchedules()).rejects.toThrow(
      "Authentication required",
    );
  });

  it("orders newest scheduled_at first and applies the limit", async () => {
    const chain = buildChain(ok([]));
    mock = buildSupabase({
      scheduled_posts: [],
      generated_posts: [],
    });
    mock.from.mockReturnValue(chain);
    (createClient as Mock).mockResolvedValue(mock.supabase);

    await listUserSchedules(25);

    expect(chain.order).toHaveBeenCalledWith("scheduled_at", {
      ascending: false,
    });
    expect(chain.limit).toHaveBeenCalledWith(25);
  });
});

describe("canTransition (state machine)", () => {
  const cases: Array<[ScheduleStatus, ScheduleStatus, boolean]> = [
    ["scheduled", "publishing", true],
    ["scheduled", "cancelled", true],
    ["publishing", "published", true],
    ["publishing", "failed", true],
    ["published", "published", false],
    ["published", "failed", false],
    ["failed", "scheduled", false],
    ["cancelled", "scheduled", false],
    ["cancelled", "publishing", false],
    ["scheduled", "published", false],
  ];

  it.each(cases)("%s → %s is %s", (from, to, expected) => {
    expect(canTransition(from, to)).toBe(expected);
  });
});

describe("findDueScheduledPosts filtering", () => {
  let adminSupabase: { from: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    adminSupabase = { from: vi.fn() };
  });

  it("only selects status='scheduled' (never published/failed/cancelled)", async () => {
    const chain = buildChain(ok([]));
    adminSupabase.from.mockReturnValue(chain);

    await findDueScheduledPosts(asAdmin(adminSupabase));

    // An already-published or failed post can never be re-selected here.
    expect(chain.eq).toHaveBeenCalledWith("status", "scheduled");
    expect(chain.lte).toHaveBeenCalledWith(
      "scheduled_at",
      expect.any(String),
    );
  });

  it("orders oldest-due first", async () => {
    const chain = buildChain(ok([]));
    adminSupabase.from.mockReturnValue(chain);

    await findDueScheduledPosts(asAdmin(adminSupabase));

    expect(chain.order).toHaveBeenCalledWith("scheduled_at", {
      ascending: true,
    });
  });
});

describe("loadPostForPublishing (ownership defense)", () => {
  let adminSupabase: { from: Mock };

  function makePost(overrides?: Partial<Record<string, unknown>>) {
    return {
      id: "post-1",
      profile_id: "user-1",
      status: "approved",
      opening: "Opening",
      body: "Body",
      takeaway: "Takeaway",
      next_step: "Next",
      hashtags: [],
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    adminSupabase = { from: vi.fn() };
  });

  it("returns the post when the owner matches the schedule owner", async () => {
    adminSupabase.from.mockReturnValue(buildChain(ok(makePost())));

    const result = await loadPostForPublishing(
      asAdmin(adminSupabase),
      "post-1",
      "user-1",
    );

    expect(result).not.toBeNull();
    expect(result?.profile_id).toBe("user-1");
  });

  it("returns null when the post belongs to another user", async () => {
    adminSupabase.from.mockReturnValue(buildChain(ok(makePost({ profile_id: "attacker" }))));

    const result = await loadPostForPublishing(
      asAdmin(adminSupabase),
      "post-1",
      "user-1",
    );

    // The scheduler must never publish another user's post.
    expect(result).toBeNull();
  });

  it("returns null when post does not exist", async () => {
    adminSupabase.from.mockReturnValue(buildChain(dbError("Not found")));

    const result = await loadPostForPublishing(
      asAdmin(adminSupabase),
      "missing",
      "user-1",
    );

    expect(result).toBeNull();
  });
});
