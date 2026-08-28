import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));

vi.mock("@/config/env.server", () => ({
  requireServerEnv: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/services/linkedin/connection", () => ({
  getAccessToken: vi.fn(),
  buildMemberUrn: (sub: string) => `urn:li:person:${sub}`,
}));

vi.mock("@/services/linkedin/publish", () => ({
  publishToLinkedIn: vi.fn(),
  loadPostImage: vi.fn(),
}));

vi.mock("@/services/scheduling", () => ({
  findDueScheduledPosts: vi.fn(),
  claimScheduledPost: vi.fn(),
  markSchedulePublished: vi.fn(),
  markScheduleFailed: vi.fn(),
  loadPostForPublishing: vi.fn(),
}));

vi.mock("@/services/generated-posts", () => ({
  updatePublishStateWithClient: vi.fn(),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import { POST } from "./route";
import { requireServerEnv } from "@/config/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessToken } from "@/services/linkedin/connection";
import { publishToLinkedIn, loadPostImage } from "@/services/linkedin/publish";
import {
  findDueScheduledPosts,
  claimScheduledPost,
  markSchedulePublished,
  markScheduleFailed,
  loadPostForPublishing,
} from "@/services/scheduling";
import { updatePublishStateWithClient } from "@/services/generated-posts";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const SCHEDULER_SECRET = "test-scheduler-secret";

const mockSchedule = {
  id: "sched-1",
  post_id: "post-1",
  profile_id: "profile-1",
  scheduled_at: "2026-08-20T10:00:00Z",
  status: "scheduled",
  attempt_count: 0,
};

const mockPostData = {
  id: "post-1",
  profile_id: "profile-1",
  status: "approved",
  opening: "Test post content",
  format: "what-i-learned",
};

const mockTokenData = {
  token: "linkedin-access-token",
  hasPublishScope: true,
  linkedinSub: "li-sub-abc",
};

const mockClaimedSchedule = {
  ...mockSchedule,
  status: "publishing",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createRequest(secret?: string): Request {
  const headers = new Headers();
  if (secret) {
    headers.set("authorization", `Bearer ${secret}`);
  }
  return new Request("http://localhost/api/scheduler/publish", {
    method: "POST",
    headers,
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/scheduler/publish", () => {
  const mockAdminClient = {} as never;

  beforeEach(() => {
    vi.clearAllMocks();
    (requireServerEnv as Mock).mockReturnValue(SCHEDULER_SECRET);
    (createAdminClient as Mock).mockReturnValue(mockAdminClient);
    (findDueScheduledPosts as Mock).mockResolvedValue([]);
    (claimScheduledPost as Mock).mockResolvedValue(null);
    (loadPostForPublishing as Mock).mockResolvedValue(null);
    (getAccessToken as Mock).mockResolvedValue(null);
    (publishToLinkedIn as Mock).mockResolvedValue({ success: false });
    (loadPostImage as Mock).mockResolvedValue(null);
    (markSchedulePublished as Mock).mockResolvedValue(undefined);
    (markScheduleFailed as Mock).mockResolvedValue(undefined);
    (updatePublishStateWithClient as Mock).mockResolvedValue(undefined);
  });

  // ── Auth ─────────────────────────────────────────────────────────────────

  it("returns 401 when no Authorization header", async () => {
    const res = await POST(createRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when wrong scheme (not Bearer)", async () => {
    const headers = new Headers();
    headers.set("authorization", `Basic ${SCHEDULER_SECRET}`);
    const req = new Request("http://localhost/api/scheduler/publish", {
      method: "POST",
      headers,
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when secret is wrong", async () => {
    const res = await POST(createRequest("wrong-secret"));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when secret is empty", async () => {
    const headers = new Headers();
    headers.set("authorization", "Bearer ");
    const req = new Request("http://localhost/api/scheduler/publish", {
      method: "POST",
      headers,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("never echoes the scheduler secret in responses", async () => {
    for (const supplied of [undefined, "wrong-secret", SCHEDULER_SECRET]) {
      const res = await POST(createRequest(supplied));
      const raw = JSON.stringify(await res.json());
      expect(raw).not.toContain(SCHEDULER_SECRET);
      if (supplied) {
        expect(raw).not.toContain(supplied);
      }
    }
  });

  // ── Empty batch ──────────────────────────────────────────────────────────

  it("returns 200 with empty results when no due posts", async () => {
    const res = await POST(createRequest(SCHEDULER_SECRET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.processed).toBe(0);
    expect(body.results).toEqual([]);
    expect(findDueScheduledPosts).toHaveBeenCalledWith(mockAdminClient, 10);
  });

  // ── Happy path ───────────────────────────────────────────────────────────

  it("successfully claims and publishes a due post", async () => {
    (findDueScheduledPosts as Mock).mockResolvedValue([mockSchedule]);
    (claimScheduledPost as Mock).mockResolvedValue(mockClaimedSchedule);
    (loadPostForPublishing as Mock).mockResolvedValue(mockPostData);
    (getAccessToken as Mock).mockResolvedValue(mockTokenData);
    (publishToLinkedIn as Mock).mockResolvedValue({
      success: true,
      linkedinPostId: "urn:li:share:123456",
    });

    const res = await POST(createRequest(SCHEDULER_SECRET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.processed).toBe(1);
    expect(body.results[0].status).toBe("published");
    expect(body.results[0].scheduleId).toBe("sched-1");
    expect(body.results[0].postId).toBe("post-1");

    expect(loadPostForPublishing).toHaveBeenCalledWith(
      mockAdminClient,
      "post-1",
      "profile-1",
    );
    expect(getAccessToken).toHaveBeenCalledWith(mockAdminClient, "profile-1");
    expect(publishToLinkedIn).toHaveBeenCalledWith(
      "linkedin-access-token",
      mockPostData,
      "urn:li:person:li-sub-abc",
    );
    expect(claimScheduledPost).toHaveBeenCalledWith(
      mockAdminClient,
      "sched-1",
      1, // attempt_count 0 + 1
    );
    expect(markSchedulePublished).toHaveBeenCalledWith(
      mockAdminClient,
      "sched-1",
      "urn:li:share:123456",
    );
    expect(updatePublishStateWithClient).toHaveBeenCalledWith(
      mockAdminClient,
      "profile-1",
      "post-1",
      {
        status: "published",
        linkedin_post_id: "urn:li:share:123456",
        published_at: expect.any(String),
        publish_error: null,
      },
    );
  });

  it("does not mark the schedule failed when post-state sync fails after publication", async () => {
    (findDueScheduledPosts as Mock).mockResolvedValue([mockSchedule]);
    (claimScheduledPost as Mock).mockResolvedValue({
      ...mockClaimedSchedule,
      attempt_count: 1,
    });
    (loadPostForPublishing as Mock).mockResolvedValue(mockPostData);
    (getAccessToken as Mock).mockResolvedValue(mockTokenData);
    (publishToLinkedIn as Mock).mockResolvedValue({
      success: true,
      linkedinPostId: "urn:li:share:999",
    });
    (updatePublishStateWithClient as Mock).mockRejectedValue(
      new Error("sync timeout"),
    );

    const res = await POST(createRequest(SCHEDULER_SECRET));
    const body = await res.json();

    // Publication succeeded — the schedule must stay published so no later
    // run can republish it. The sync problem is surfaced as a warning only.
    expect(body.results[0].status).toBe("published");
    expect(body.results[0].error).toContain("failed to sync post state");
    expect(markSchedulePublished).toHaveBeenCalledTimes(1);
    expect(markScheduleFailed).not.toHaveBeenCalled();
  });

  it("fails the schedule when the post belongs to a different user", async () => {
    (findDueScheduledPosts as Mock).mockResolvedValue([mockSchedule]);
    (claimScheduledPost as Mock).mockResolvedValue(mockClaimedSchedule);
    (loadPostForPublishing as Mock).mockResolvedValue(null); // ownership mismatch → null

    const res = await POST(createRequest(SCHEDULER_SECRET));
    const body = await res.json();

    expect(body.results[0].status).toBe("failed");
    expect(publishToLinkedIn).not.toHaveBeenCalled();
  });

  // ── Claim conflict ───────────────────────────────────────────────────────

  it("skips posts already claimed by another process", async () => {
    (findDueScheduledPosts as Mock).mockResolvedValue([mockSchedule]);
    (claimScheduledPost as Mock).mockResolvedValue(null);

    const res = await POST(createRequest(SCHEDULER_SECRET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.processed).toBe(1);
    expect(body.results[0].status).toBe("skipped");
    expect(body.results[0].error).toBe("Already claimed by another process");
    expect(loadPostForPublishing).not.toHaveBeenCalled();
  });

  it("a second cron execution never republishes the same post", async () => {
    // Simulates GitHub Actions running twice concurrently/serially:
    // Run 1 wins the claim and publishes; Run 2's claim returns null.
    (findDueScheduledPosts as Mock).mockResolvedValue([mockSchedule]);
    (claimScheduledPost as Mock)
      .mockResolvedValueOnce({ ...mockClaimedSchedule })
      .mockResolvedValueOnce(null); // Run 2 loses the atomic claim
    (loadPostForPublishing as Mock).mockResolvedValue(mockPostData);
    (getAccessToken as Mock).mockResolvedValue(mockTokenData);
    (publishToLinkedIn as Mock).mockResolvedValue({
      success: true,
      linkedinPostId: "urn:li:share:111",
    });

    await POST(createRequest(SCHEDULER_SECRET)); // Run 1
    const res2 = await POST(createRequest(SCHEDULER_SECRET)); // Run 2
    const body2 = await res2.json();

    // Exactly one publication across both runs.
    expect(publishToLinkedIn).toHaveBeenCalledTimes(1);
    expect(markSchedulePublished).toHaveBeenCalledTimes(1);
    expect(body2.results[0].status).toBe("skipped");
  });

  // ── Post not found ───────────────────────────────────────────────────────

  it("handles post not found gracefully", async () => {
    (findDueScheduledPosts as Mock).mockResolvedValue([mockSchedule]);
    (claimScheduledPost as Mock).mockResolvedValue(mockClaimedSchedule);
    (loadPostForPublishing as Mock).mockResolvedValue(null);

    const res = await POST(createRequest(SCHEDULER_SECRET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results[0].status).toBe("failed");
    expect(body.results[0].error).toBe("Post not found");
    expect(markScheduleFailed).toHaveBeenCalledWith(
      mockAdminClient,
      "sched-1",
      "Post not found.",
    );
  });

  // ── Non-approved post status ─────────────────────────────────────────────

  it("handles non-approved post status", async () => {
    (findDueScheduledPosts as Mock).mockResolvedValue([mockSchedule]);
    (claimScheduledPost as Mock).mockResolvedValue(mockClaimedSchedule);
    (loadPostForPublishing as Mock).mockResolvedValue({
      ...mockPostData,
      status: "draft",
    });

    const res = await POST(createRequest(SCHEDULER_SECRET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results[0].status).toBe("failed");
    expect(body.results[0].error).toBe('Post status "draft"');
    expect(markScheduleFailed).toHaveBeenCalledWith(
      mockAdminClient,
      "sched-1",
      'Post status is "draft", expected "approved".',
    );
  });

  // ── Expired LinkedIn connection ───────────────────────────────────────────

  it("handles expired LinkedIn connection", async () => {
    (findDueScheduledPosts as Mock).mockResolvedValue([mockSchedule]);
    (claimScheduledPost as Mock).mockResolvedValue(mockClaimedSchedule);
    (loadPostForPublishing as Mock).mockResolvedValue(mockPostData);
    (getAccessToken as Mock).mockResolvedValue(null);

    const res = await POST(createRequest(SCHEDULER_SECRET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results[0].status).toBe("failed");
    expect(body.results[0].error).toBe("LinkedIn not connected");
    expect(markScheduleFailed).toHaveBeenCalledWith(
      mockAdminClient,
      "sched-1",
      "LinkedIn connection expired. Reconnect LinkedIn and retry this post.",
    );
  });

  // ── Insufficient LinkedIn scope ───────────────────────────────────────────

  it("handles insufficient LinkedIn scope", async () => {
    (findDueScheduledPosts as Mock).mockResolvedValue([mockSchedule]);
    (claimScheduledPost as Mock).mockResolvedValue(mockClaimedSchedule);
    (loadPostForPublishing as Mock).mockResolvedValue(mockPostData);
    (getAccessToken as Mock).mockResolvedValue({
      token: "linkedin-access-token",
      hasPublishScope: false,
    });

    const res = await POST(createRequest(SCHEDULER_SECRET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results[0].status).toBe("failed");
    expect(body.results[0].error).toBe("Insufficient scope");
    expect(markScheduleFailed).toHaveBeenCalledWith(
      mockAdminClient,
      "sched-1",
      "LinkedIn connection lacks publishing permissions. Reconnect with full permissions.",
    );
  });

  // ── LinkedIn API failure ──────────────────────────────────────────────────

  it("handles LinkedIn API failure", async () => {
    (findDueScheduledPosts as Mock).mockResolvedValue([mockSchedule]);
    (claimScheduledPost as Mock).mockResolvedValue(mockClaimedSchedule);
    (loadPostForPublishing as Mock).mockResolvedValue(mockPostData);
    (getAccessToken as Mock).mockResolvedValue(mockTokenData);
    (publishToLinkedIn as Mock).mockResolvedValue({
      success: false,
      error: "Rate limit exceeded",
    });

    const res = await POST(createRequest(SCHEDULER_SECRET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results[0].status).toBe("failed");
    expect(body.results[0].error).toBe("Rate limit exceeded");
    expect(markScheduleFailed).toHaveBeenCalledWith(
      mockAdminClient,
      "sched-1",
      "Rate limit exceeded",
    );
    expect(updatePublishStateWithClient).toHaveBeenCalledWith(
      mockAdminClient,
      "profile-1",
      "post-1",
      { publish_error: "Rate limit exceeded" },
    );
  });

  // ── Internal error ───────────────────────────────────────────────────────

  it("returns 500 on internal error", async () => {
    (findDueScheduledPosts as Mock).mockRejectedValue(
      new Error("Database connection failed"),
    );

    const res = await POST(createRequest(SCHEDULER_SECRET));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Database connection failed");
  });

  // ── Per-post error isolation ──────────────────────────────────────────────

  it("continues processing remaining posts when one post throws", async () => {
    const schedule1 = { ...mockSchedule, id: "sched-1", post_id: "post-1" };
    const schedule2 = { ...mockSchedule, id: "sched-2", post_id: "post-2" };
    (findDueScheduledPosts as Mock).mockResolvedValue([schedule1, schedule2]);
    (claimScheduledPost as Mock)
      .mockResolvedValueOnce({ ...schedule1, status: "publishing" })
      .mockResolvedValueOnce({ ...schedule2, status: "publishing" });

    (loadPostForPublishing as Mock).mockImplementation(async (_client, postId) => {
      if (postId === "post-1") throw new Error("DB read timeout");
      return { ...mockPostData, id: postId };
    });
    (getAccessToken as Mock).mockResolvedValue(mockTokenData);
    (publishToLinkedIn as Mock).mockResolvedValue({
      success: true,
      linkedinPostId: "urn:li:share:789",
    });

    const res = await POST(createRequest(SCHEDULER_SECRET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.processed).toBe(2);
    expect(body.results[0].status).toBe("error");
    expect(body.results[0].error).toBe("DB read timeout");
    expect(body.results[1].status).toBe("published");
    expect(body.results[1].scheduleId).toBe("sched-2");
  });

  // ── publishToLinkedIn throws ──────────────────────────────────────────────

  it("handles publishToLinkedIn throwing an exception", async () => {
    (findDueScheduledPosts as Mock).mockResolvedValue([mockSchedule]);
    (claimScheduledPost as Mock).mockResolvedValue(mockClaimedSchedule);
    (loadPostForPublishing as Mock).mockResolvedValue(mockPostData);
    (getAccessToken as Mock).mockResolvedValue(mockTokenData);
    (publishToLinkedIn as Mock).mockRejectedValue(new Error("Network timeout"));

    const res = await POST(createRequest(SCHEDULER_SECRET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results[0].status).toBe("error");
    expect(body.results[0].error).toBe("Network timeout");
    expect(markScheduleFailed).toHaveBeenCalledWith(
      mockAdminClient,
      "sched-1",
      "Network timeout",
    );
  });
});
