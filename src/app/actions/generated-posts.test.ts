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
}));

vi.mock("@/services/ai/generation", () => ({
  generatePostForDay: vi.fn(),
}));

vi.mock("@/services/linkedin", () => ({
  getAccessToken: vi.fn(),
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
  regeneratePost,
  publishPost,
} from "./generated-posts";
import {
  getGeneratedPost,
  getGeneratedPostHistory,
  updateGeneratedPost,
  changeGeneratedPostStatus,
  deleteGeneratedPost,
  updatePublishState,
} from "@/services/generated-posts";
import { generatePostForDay } from "@/services/ai/generation";
import { getAccessToken, publishToLinkedIn } from "@/services/linkedin";
import { createWriteClient } from "@/lib/supabase/server";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const mockPost = {
  id: "post-1",
  profile_id: "user-1",
  journal_entry_id: "journal-1",
  day_number: 1,
  status: "draft",
  format: "what-i-learned",
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
      (changeGeneratedPostStatus as Mock).mockResolvedValue(approvedPost);

      const result = await approvePost("post-1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.post.status).toBe("approved");
      }
      expect(changeGeneratedPostStatus).toHaveBeenCalledWith("post-1", "approved");
    });

    it("returns error on invalid transition", async () => {
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

  // ─── regeneratePost ─────────────────────────────────────────────────────

  describe("regeneratePost", () => {
    it("returns success with new post", async () => {
      const newPost = { ...mockPost, id: "post-2" };
      (generatePostForDay as Mock).mockResolvedValue(newPost);

      const result = await regeneratePost(1, "challenge");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.post.id).toBe("post-2");
      }
      expect(generatePostForDay).toHaveBeenCalledWith(1, "challenge");
    });

    it("returns error on generation failure", async () => {
      (generatePostForDay as Mock).mockRejectedValue(new Error("Generation failed"));

      const result = await regeneratePost(1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("GENERATION_FAILED");
        expect(result.error.message).toBe("Generation failed");
      }
    });

    it("handles duplicate error", async () => {
      (generatePostForDay as Mock).mockRejectedValue(
        Object.assign(new Error("Duplicate content"), { code: "GENERATION_DUPLICATE" }),
      );

      const result = await regeneratePost(1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("GENERATION_DUPLICATE");
      }
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

    it("returns LINKEDIN_NOT_CONNECTED when no token", async () => {
      const approvedPost = { ...mockPost, status: "approved" };
      (getGeneratedPost as Mock).mockResolvedValue(approvedPost);
      (getAccessToken as Mock).mockResolvedValue(null);

      const result = await publishPost("post-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("LINKEDIN_NOT_CONNECTED");
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
        error: "INSUFFICIENT_SCOPE",
      });
      (updatePublishState as Mock).mockResolvedValue({
        ...approvedPost,
        publish_error: "INSUFFICIENT_SCOPE",
      });

      const result = await publishPost("post-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("PUBLISH_FAILED");
      }
      expect(updatePublishState).toHaveBeenCalledWith("post-1", {
        publish_error: "INSUFFICIENT_SCOPE",
      });
    });
  });
});
