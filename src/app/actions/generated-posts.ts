"use server";

import {
  getGeneratedPost,
  getGeneratedPostHistory,
  updateGeneratedPost,
  changeGeneratedPostStatus,
  deleteGeneratedPost,
  updatePublishState,
} from "@/services/generated-posts";
import { generatePostForDay } from "@/services/ai/generation";
import { getAccessToken, buildMemberUrn, publishToLinkedIn } from "@/services/linkedin";
import { createWriteClient } from "@/lib/supabase/server";
import type {
  GeneratedPostRow,
  GeneratedPostStatus,
  UpdateGeneratedPostInput,
} from "@/types/generated-post";
import type { PostFormat } from "@/types/ai";

// ─── Result Types ────────────────────────────────────────────────────────────

export type PostActionResult =
  | { success: true; post: GeneratedPostRow }
  | { success: false; error: { code: string; message: string } };

export type PostListResult =
  | { success: true; posts: GeneratedPostRow[] }
  | { success: false; error: { code: string; message: string } };

// ─── Server Actions ──────────────────────────────────────────────────────────

export async function getPost(postId: string): Promise<PostActionResult> {
  try {
    const post = await getGeneratedPost(postId);
    if (!post) {
      return {
        success: false,
        error: { code: "POST_NOT_FOUND", message: "Post not found." },
      };
    }
    return { success: true, post };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load post.";
    const code = err instanceof Error && "code" in err ? (err as { code: string }).code : "UNKNOWN";
    return { success: false, error: { code, message } };
  }
}

export async function getPostHistory(): Promise<PostListResult> {
  try {
    const posts = await getGeneratedPostHistory();
    return { success: true, posts };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load posts.";
    const code = err instanceof Error && "code" in err ? (err as { code: string }).code : "UNKNOWN";
    return { success: false, error: { code, message } };
  }
}

export async function updatePost(
  postId: string,
  input: UpdateGeneratedPostInput,
): Promise<PostActionResult> {
  try {
    const post = await updateGeneratedPost(postId, input);
    return { success: true, post };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update post.";
    const code = err instanceof Error && "code" in err ? (err as { code: string }).code : "UNKNOWN";
    return { success: false, error: { code, message } };
  }
}

export async function approvePost(postId: string): Promise<PostActionResult> {
  try {
    const post = await changeGeneratedPostStatus(postId, "approved" as GeneratedPostStatus);
    return { success: true, post };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to approve post.";
    const code = err instanceof Error && "code" in err ? (err as { code: string }).code : "UNKNOWN";
    return { success: false, error: { code, message } };
  }
}

export async function deletePost(postId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteGeneratedPost(postId);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete post.";
    return { success: false, error: message };
  }
}

export type PostPublishResult =
  | { success: true; post: GeneratedPostRow }
  | { success: false; error: { code: string; message: string } };

export async function regeneratePost(
  dayNumber: number,
  format?: PostFormat,
): Promise<PostActionResult> {
  try {
    const post = await generatePostForDay(dayNumber, format);
    return { success: true, post };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to regenerate post.";
    const code = err instanceof Error && "code" in err ? (err as { code: string }).code : "GENERATION_FAILED";
    return { success: false, error: { code, message } };
  }
}

/**
 * Publishes an approved post to LinkedIn.
 *
 * Flow:
 * 1. Verify post is owned by the user and has status "approved"
 * 2. Retrieve the LinkedIn access token (server-side only)
 * 3. Check for w_member_social scope
 * 4. Call LinkedIn UGC Posts API
 * 5. Update the post with publish result
 *
 * Returns a specific error code "INSUFFICIENT_SCOPE" when the LinkedIn
 * connection lacks w_member_social, so the UI can redirect to reauth.
 * Returns "ALREADY_PUBLISHED" if the post has already been published.
 */
export async function publishPost(postId: string): Promise<PostPublishResult> {
  try {
    // 1. Load and verify the post
    const post = await getGeneratedPost(postId);
    if (!post) {
      return {
        success: false,
        error: { code: "POST_NOT_FOUND", message: "Post not found." },
      };
    }

    // 2. Only approved posts may be published
    if (post.status !== "approved") {
      return {
        success: false,
        error: {
          code: "INVALID_STATUS",
          message: "Only approved posts can be published.",
        },
      };
    }

    // 3. Get the LinkedIn access token (server-side only)
    const supabase = await createWriteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        error: { code: "AUTH_REQUIRED", message: "Authentication required." },
      };
    }

    const tokenData = await getAccessToken(supabase, user.id);

    if (!tokenData) {
      return {
        success: false,
        error: {
          code: "LINKEDIN_NOT_CONNECTED",
          message: "LinkedIn account is not connected. Please connect your LinkedIn account first.",
        },
      };
    }

    // 4. Check for w_member_social scope
    if (!tokenData.hasPublishScope) {
      return {
        success: false,
        error: {
          code: "INSUFFICIENT_SCOPE",
          message: "LinkedIn connection needs additional permissions to publish. Please reconnect with publishing permissions.",
        },
      };
    }

    // 5. Build the member URN and publish
    const memberUrn = buildMemberUrn(tokenData.linkedinSub);
    const result = await publishToLinkedIn(tokenData.token, post, memberUrn);

    // 6. Update the post based on the result
    if (result.success && result.linkedinPostId) {
      const updatedPost = await updatePublishState(postId, {
        status: "published",
        linkedin_post_id: result.linkedinPostId,
        published_at: new Date().toISOString(),
        publish_error: null,
      });
      return { success: true, post: updatedPost };
    }

    // Publishing failed — store error, keep as approved
    const errorMessage = result.error ?? "Unknown publishing error";
    await updatePublishState(postId, {
      publish_error: errorMessage,
    });

    return {
      success: false,
      error: {
        code: "PUBLISH_FAILED",
        message: `Publishing failed: ${errorMessage}`,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to publish post.";
    const code = err instanceof Error && "code" in err ? (err as { code: string }).code : "PUBLISH_FAILED";
    return { success: false, error: { code, message } };
  }
}
