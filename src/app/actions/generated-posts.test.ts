import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/services/generated-posts", () => ({
  getGeneratedPost: vi.fn(),
  getGeneratedPostHistory: vi.fn(),
  updateGeneratedPost: vi.fn(),
  changeGeneratedPostStatus: vi.fn(),
  deleteGeneratedPost: vi.fn(),
  updatePublishState: vi.fn(),
  annotateGeneratedPostQuality: vi.fn(),
}));

vi.mock("@/services/ai/generation", () => ({
  loadCurriculumDayForRecruiter: vi.fn(),
  loadJournalEntryForRecruiter: vi.fn(),
  loadModuleForRecruiter: vi.fn(),
}));

vi.mock("@/services/linkedin", () => ({
  getAccessToken: vi.fn(),
  getConnectionStatus: vi.fn(),
  buildMemberUrn: (sub: string) => `urn:li:person:${sub}`,
  publishToLinkedIn: vi.fn(),
  loadPostImage: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createWriteClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import {
  getPost,
  getPostHistory,
  updatePost,
  approvePost,
  deletePost,
  publishPost,
} from "./generated-posts";
import {
  getGeneratedPost,
  getGeneratedPostHistory,
  updateGeneratedPost,
  changeGeneratedPostStatus,
  deleteGeneratedPost,
  updatePublishState,
  annotateGeneratedPostQuality,
} from "@/services/generated-posts";
import { getAccessToken, publishToLinkedIn } from "@/services/linkedin";
import { createWriteClient } from "@/lib/supabase/server";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const mockPost = {
  id: "post-1",
  profile_id: "user-1",
  journal_entry_id: "journal-1",
  day_number: 1,
  status: "draft" as const,
  format: "what-i-learned" as const,
  opening: "Today I learned Git.",
  body: "Git is a version control system.",
  takeaway: "Git saves versions.",
  next_step: "Learn branches.",
  hashtags: ["#105DaysOfCode", "#Git"],
  image_headline: "Learning Git",
  image_subheadline: "Day 1",
  image_keywords: ["git"],
  image_visual_concept: "Git concept",
  image_template: "learner-progress",
  provider: "fallback",
  model: "template-v1",
  tokens_used: null,
  content_hash: "abc123",
  linkedin_post_id: null,
  published_at: null,
  publish_error: null,
  created_at: "2026-08-17T10:00:00Z",
  updated_at: "2026-08-17T10:00:00Z",
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Post Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getPost ────────────────────────────────────────────────────────────

  describe("getPost", () => {
    it("returns success with post", async () => {
      (getGeneratedPost as Mock).mockResolvedValue(mockPost);

      const result = await getPost("post-1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.post.id).toBe("post-1");
      }
    });

    it("returns error when post not found", async () => {
      (getGeneratedPost as Mock).mockResolvedValue(null);

      const result = await getPost("nonexistent");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("POST_NOT_FOUND");
      }
    });

    it("returns error on exception", async () => {
      (getGeneratedPost as Mock).mockRejectedValue(new Error("DB error"));

      const result = await getPost("post-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("DB error");
      }
    });
  });

  // ─── getPostHistory ─────────────────────────────────────────────────────

  describe("getPostHistory", () => {
    it("returns success with posts", async () => {
      (getGeneratedPostHistory as Mock).mockResolvedValue([mockPost]);

      const result = await getPostHistory();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.posts).toHaveLength(1);
      }
    });

    it("returns error on exception", async () => {
      (getGeneratedPostHistory as Mock).mockRejectedValue(new Error("DB error"));

      const result = await getPostHistory();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("DB error");
      }
    });
  });

  // ─── updatePost ─────────────────────────────────────────────────────────

  describe("updatePost", () => {
    it("returns success with updated post", async () => {
      const updatedPost = { ...mockPost, opening: "Updated opening" };
      (updateGeneratedPost as Mock).mockResolvedValue(updatedPost);

      const result = await updatePost("post-1", { opening: "Updated opening" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.post.opening).toBe("Updated opening");
      }
    });

    it("returns error on failure", async () => {
      (updateGeneratedPost as Mock).mockRejectedValue(new Error("Update failed"));

      const result = await updatePost("post-1", { opening: "Updated" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("Update failed");
      }
    });
  });

  // ─── approvePost ────────────────────────────────────────────────────────

  describe("approvePost", () => {
    it("returns success with approved post", async () => {
      const approvedPost = { ...mockPost, status: "approved" };
      (getGeneratedPost as Mock).mockResolvedValue(mockPost);
      (changeGeneratedPostStatus as Mock).mockResolvedValue(approvedPost);

      const result = await approvePost("post-1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.post.status).toBe("approved");
      }
      expect(changeGeneratedPostStatus).toHaveBeenCalledWith("post-1", "approved");
    });

    it("approves a needs_review opportunity post after re-evaluation with confirmation", async () => {
      const needsReviewReport = {
        score: 60,
        recommendation: "needs_review" as const,
        dimensions: {
          recruiterRelevance: 60,
          evidenceStrength: 60,
          technicalDepth: 50,
          practicalExperience: 50,
          problemSolving: 50,
          clarity: 70,
          authenticity: 70,
          learningGrowth: 50,
        },
        strengths: [],
        improvements: [],
        warnings: [],
        evaluatedAt: "2026-08-28T10:00:00Z",
      };
      const opportunityPost = {
        ...mockPost,
        opportunity_id: "op-1",
        recruiter_quality_score: 60,
        recruiter_quality_report: needsReviewReport,
      };
      const approvedPost = { ...opportunityPost, status: "approved" as const };
      (getGeneratedPost as Mock).mockResolvedValue(opportunityPost);

      // The approve path re-evaluates server-side before approving. Quality-service
      // modules are real pure code here; mock the persistence layer it uses.
      const qualityService = await import("@/services/recruiter/quality-service");
      vi.mocked(annotateGeneratedPostQuality).mockResolvedValue(opportunityPost);
      const evaluateSpy = vi.spyOn(qualityService, "evaluateRecruiterPostForSavedPost");
      evaluateSpy.mockResolvedValue({ post: opportunityPost, report: needsReviewReport });

      (changeGeneratedPostStatus as Mock).mockResolvedValue(approvedPost);

      const result = await approvePost("post-1");

      expect(result.success).toBe(true);
      if (result.success) expect(result.post.status).toBe("approved");
    });

    it("blocks approval when the quality gate returns do_not_publish", async () => {
      const doNotPublishReport = {
        score: 50,
        recommendation: "do_not_publish" as const,
        dimensions: {
          recruiterRelevance: 60,
          evidenceStrength: 40,
          technicalDepth: 50,
          practicalExperience: 40,
          problemSolving: 50,
          clarity: 70,
          authenticity: 70,
          learningGrowth: 50,
        },
        strengths: [],
        improvements: [],
        warnings: ["Critical: the post makes a personal achievement claim."],
        evaluatedAt: "2026-08-28T10:00:00Z",
      };
      const opportunityPost = {
        ...mockPost,
        opportunity_id: "op-1",
        recruiter_quality_score: 50,
        recruiter_quality_report: doNotPublishReport,
      };
      (getGeneratedPost as Mock).mockResolvedValue(opportunityPost);

      const qualityService = await import("@/services/recruiter/quality-service");
      vi.mocked(annotateGeneratedPostQuality).mockResolvedValue(opportunityPost);
      const evaluateSpy = vi.spyOn(qualityService, "evaluateRecruiterPostForSavedPost");
      evaluateSpy.mockResolvedValue({ post: opportunityPost, report: doNotPublishReport });

      const result = await approvePost("post-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("QUALITY_GATE_BLOCKED");
      }
      expect(changeGeneratedPostStatus).not.toHaveBeenCalled();
    });

    it("syncs the linked opportunity to approved when an opportunity post is approved", async () => {
      const opportunityPost = { ...mockPost, status: "generated" as const, opportunity_id: "op-1" };
      const approvedPost = { ...opportunityPost, status: "approved" as const };
      (getGeneratedPost as Mock).mockResolvedValue(opportunityPost);
      (changeGeneratedPostStatus as Mock).mockResolvedValue(approvedPost);

      const qualityService = await import("@/services/recruiter/quality-service");
      const evaluateSpy = vi.spyOn(qualityService, "evaluateRecruiterPostForSavedPost");
      evaluateSpy.mockResolvedValue(null);

      const persistence = await import("@/services/recruiter/persistence");
      const syncSpy = vi.spyOn(persistence, "updateContentOpportunityStatus");
      syncSpy.mockRejectedValue(new Error("best-effort"));

      const result = await approvePost("post-1");

      expect(result.success).toBe(true);
      if (result.success) expect(result.post.status).toBe("approved");
      expect(syncSpy).toHaveBeenCalledWith("op-1", "approved");
    });

    it("returns error on invalid transition", async () => {
      (getGeneratedPost as Mock).mockResolvedValue(mockPost);
      (changeGeneratedPostStatus as Mock).mockRejectedValue(
        new Error("Invalid status transition"),
      );

      const result = await approvePost("post-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("Invalid status transition");
      }
    });
  });

  // ─── deletePost ─────────────────────────────────────────────────────────

  describe("deletePost", () => {
    it("returns success on delete", async () => {
      (deleteGeneratedPost as Mock).mockResolvedValue(undefined);

      const result = await deletePost("post-1");

      expect(result.success).toBe(true);
    });

    it("returns error on failure", async () => {
      (deleteGeneratedPost as Mock).mockRejectedValue(new Error("Cannot delete"));

      const result = await deletePost("post-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot delete");
    });
  });

  // ─── publishPost ────────────────────────────────────────────────────────

  describe("publishPost", () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
    };

    beforeEach(() => {
      (createWriteClient as Mock).mockResolvedValue(mockSupabase);
    });

    it("returns success (existing result) when the post is already published", async () => {
      const publishedPost = { ...mockPost, status: "published" };
      (getGeneratedPost as Mock).mockResolvedValue(publishedPost);

      const result = await publishPost("post-1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.post.status).toBe("published");
      }
      // Idempotency: no LinkedIn call, no status write.
      expect(getAccessToken).not.toHaveBeenCalled();
      expect(publishToLinkedIn).not.toHaveBeenCalled();
      expect(updatePublishState).not.toHaveBeenCalled();
    });

    it("returns success when post is published", async () => {
      const approvedPost = { ...mockPost, status: "approved" };
      (getGeneratedPost as Mock).mockResolvedValue(approvedPost);
      (getAccessToken as Mock).mockResolvedValue({
        token: "test-token",
        hasPublishScope: true,
        linkedinSub: "li-sub-user",
      });
      (publishToLinkedIn as Mock).mockResolvedValue({
        success: true,
        linkedinPostId: "urn:li:share:12345",
      });
      const publishedPost = {
        ...approvedPost,
        status: "published",
        linkedin_post_id: "urn:li:share:12345",
      };
      (updatePublishState as Mock).mockResolvedValue(publishedPost);

      const result = await publishPost("post-1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.post.status).toBe("published");
      }
      expect(publishToLinkedIn).toHaveBeenCalledWith(
        "test-token",
        approvedPost,
        "urn:li:person:li-sub-user",
      );
    });

    it("passes the generated image to publishToLinkedIn when one exists", async () => {
      const approvedPost = { ...mockPost, status: "approved" };
      (getGeneratedPost as Mock).mockResolvedValue(approvedPost);
      (getAccessToken as Mock).mockResolvedValue({
        token: "test-token",
        hasPublishScope: true,
        linkedinSub: "li-sub-user",
      });
      const imageInput = {
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: "image/png",
        altText: "Day 1 of the journey",
      };
      const { loadPostImage } = await import("@/services/linkedin");
      (loadPostImage as Mock).mockResolvedValue(imageInput);
      (publishToLinkedIn as Mock).mockResolvedValue({
        success: true,
        linkedinPostId: "urn:li:share:456",
      });
      (updatePublishState as Mock).mockResolvedValue({
        ...approvedPost,
        status: "published",
        linkedin_post_id: "urn:li:share:456",
      });

      const result = await publishPost("post-1");

      expect(result.success).toBe(true);
      expect(publishToLinkedIn).toHaveBeenCalledWith(
        "test-token",
        approvedPost,
        "urn:li:person:li-sub-user",
        imageInput,
      );
    });

    it("returns POST_NOT_FOUND when post does not exist", async () => {
      (getGeneratedPost as Mock).mockResolvedValue(null);

      const result = await publishPost("nonexistent");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("POST_NOT_FOUND");
      }
    });

    it("returns INVALID_STATUS when post is not approved", async () => {
      const draftPost = { ...mockPost, status: "draft" };
      (getGeneratedPost as Mock).mockResolvedValue(draftPost);

      const result = await publishPost("post-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_STATUS");
      }
    });

    it("returns LINKEDIN_NOT_CONNECTED when no connection exists", async () => {
      const approvedPost = { ...mockPost, status: "approved" };
      (getGeneratedPost as Mock).mockResolvedValue(approvedPost);
      (getAccessToken as Mock).mockResolvedValue(null);
      const { getConnectionStatus } = await import("@/services/linkedin");
      (getConnectionStatus as Mock).mockResolvedValue({ status: "disconnected" });

      const result = await publishPost("post-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("LINKEDIN_NOT_CONNECTED");
      }
    });

    it("returns LINKEDIN_TOKEN_EXPIRED when the connection is expired", async () => {
      const approvedPost = { ...mockPost, status: "approved" };
      (getGeneratedPost as Mock).mockResolvedValue(approvedPost);
      (getAccessToken as Mock).mockResolvedValue(null);
      const { getConnectionStatus } = await import("@/services/linkedin");
      (getConnectionStatus as Mock).mockResolvedValue({ status: "expired" });

      const result = await publishPost("post-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("LINKEDIN_TOKEN_EXPIRED");
        expect(result.error.message).toMatch(/expired/i);
      }
    });

    it("returns INSUFFICIENT_SCOPE when missing w_member_social", async () => {
      const approvedPost = { ...mockPost, status: "approved" };
      (getGeneratedPost as Mock).mockResolvedValue(approvedPost);
      (getAccessToken as Mock).mockResolvedValue({
        token: "test-token",
        hasPublishScope: false,
      });

      const result = await publishPost("post-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INSUFFICIENT_SCOPE");
      }
    });

    it("returns PUBLISH_FAILED when LinkedIn API fails", async () => {
      const approvedPost = { ...mockPost, status: "approved" };
      (getGeneratedPost as Mock).mockResolvedValue(approvedPost);
      (getAccessToken as Mock).mockResolvedValue({
        token: "test-token",
        hasPublishScope: true,
        linkedinSub: "li-sub-user",
      });
      (publishToLinkedIn as Mock).mockResolvedValue({
        success: false,
        error: "Network error: fetch failed",
      });
      (updatePublishState as Mock).mockResolvedValue({
        ...approvedPost,
        publish_error:
          "Unable to reach LinkedIn. Check your connection and try again.",
      });

      const result = await publishPost("post-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("LINKEDIN_UNREACHABLE");
      }
      // The safe, display-ready message is persisted — never the raw provider
      // error or any token material.
      expect(updatePublishState).toHaveBeenCalledWith("post-1", {
        publish_error:
          "Unable to reach LinkedIn. Check your connection and try again.",
      });
    });

    it("maps a 401 to a token-invalid message", async () => {
      const approvedPost = { ...mockPost, status: "approved" };
      (getGeneratedPost as Mock).mockResolvedValue(approvedPost);
      (getAccessToken as Mock).mockResolvedValue({
        token: "test-token",
        hasPublishScope: true,
        linkedinSub: "li-sub-user",
      });
      (publishToLinkedIn as Mock).mockResolvedValue({
        success: false,
        error: "LinkedIn API error (401): invalid token",
      });
      (updatePublishState as Mock).mockResolvedValue(approvedPost);

      const result = await publishPost("post-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("LINKEDIN_TOKEN_INVALID");
        expect(result.error.message).toMatch(/reconnect/i);
      }
    });

    it("maps a 429 to a rate-limit message", async () => {
      const approvedPost = { ...mockPost, status: "approved" };
      (getGeneratedPost as Mock).mockResolvedValue(approvedPost);
      (getAccessToken as Mock).mockResolvedValue({
        token: "test-token",
        hasPublishScope: true,
        linkedinSub: "li-sub-user",
      });
      (publishToLinkedIn as Mock).mockResolvedValue({
        success: false,
        error: "LinkedIn API error (429): too many requests",
      });
      (updatePublishState as Mock).mockResolvedValue(approvedPost);

      const result = await publishPost("post-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("LINKEDIN_RATE_LIMITED");
      }
    });

    it("maps a 5xx to an unavailable message", async () => {
      const approvedPost = { ...mockPost, status: "approved" };
      (getGeneratedPost as Mock).mockResolvedValue(approvedPost);
      (getAccessToken as Mock).mockResolvedValue({
        token: "test-token",
        hasPublishScope: true,
        linkedinSub: "li-sub-user",
      });
      (publishToLinkedIn as Mock).mockResolvedValue({
        success: false,
        error: "LinkedIn API error (503): service unavailable",
      });
      (updatePublishState as Mock).mockResolvedValue(approvedPost);

      const result = await publishPost("post-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("LINKEDIN_UNAVAILABLE");
      }
    });

    it("blocks publishing an opportunity post whose re-evaluated quality is do_not_publish", async () => {
      const doNotPublishReport = {
        score: 50,
        recommendation: "do_not_publish" as const,
        dimensions: {
          recruiterRelevance: 60,
          evidenceStrength: 40,
          technicalDepth: 50,
          practicalExperience: 40,
          problemSolving: 50,
          clarity: 70,
          authenticity: 70,
          learningGrowth: 50,
        },
        strengths: [],
        improvements: [],
        warnings: ["Critical: the post makes a personal achievement claim."],
        evaluatedAt: "2026-08-28T10:00:00Z",
      };
      const approvedPost = {
        ...mockPost,
        status: "approved" as const,
        opportunity_id: "op-1",
        recruiter_quality_score: 50,
        recruiter_quality_report: doNotPublishReport,
      };
      (getGeneratedPost as Mock).mockResolvedValue(approvedPost);

      const qualityService = await import("@/services/recruiter/quality-service");
      const evaluateSpy = vi.spyOn(qualityService, "evaluateRecruiterPostForSavedPost");
      evaluateSpy.mockResolvedValue({ post: approvedPost, report: doNotPublishReport });

      const result = await publishPost("post-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("QUALITY_GATE_BLOCKED");
      }
      expect(getAccessToken).not.toHaveBeenCalled();
      expect(publishToLinkedIn).not.toHaveBeenCalled();
    });

    it("syncs the linked opportunity to published after a successful publish", async () => {
      const approvedPost = { ...mockPost, status: "approved" as const, opportunity_id: "op-1" };
      (getGeneratedPost as Mock).mockResolvedValue(approvedPost);
      const qualityService = await import("@/services/recruiter/quality-service");
      const evaluateSpy = vi.spyOn(qualityService, "evaluateRecruiterPostForSavedPost");
      evaluateSpy.mockResolvedValue(null);
      (getAccessToken as Mock).mockResolvedValue({
        token: "test-token",
        hasPublishScope: true,
        linkedinSub: "li-sub-user",
      });
      (publishToLinkedIn as Mock).mockResolvedValue({
        success: true,
        linkedinPostId: "urn:li:share:777",
      });
      (updatePublishState as Mock).mockResolvedValue({
        ...approvedPost,
        status: "published" as const,
        linkedin_post_id: "urn:li:share:777",
      });
      const persistence = await import("@/services/recruiter/persistence");
      const syncSpy = vi.spyOn(persistence, "updateContentOpportunityStatus");
      syncSpy.mockRejectedValue(new Error("best-effort"));

      const result = await publishPost("post-1");

      expect(result.success).toBe(true);
      expect(syncSpy).toHaveBeenCalledWith("op-1", "published");
    });
  });
});
