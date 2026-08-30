"use server";

import {
  getGeneratedPost,
  getGeneratedPostHistory,
  updateGeneratedPost,
  changeGeneratedPostStatus,
  deleteGeneratedPost,
  updatePublishState,
} from "@/services/generated-posts";
import { getAccessToken, getConnectionStatus, buildMemberUrn, publishToLinkedIn, loadPostImage } from "@/services/linkedin";
import { updateContentOpportunityStatus } from "@/services/recruiter/persistence";
import { createWriteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  GeneratedPostRow,
  GeneratedPostStatus,
  UpdateGeneratedPostInput,
} from "@/types/generated-post";
import type { RecruiterQualityReport } from "@/types/recruiter-quality";
import { evaluateApproveGate } from "@/services/recruiter/quality";
import { evaluateRecruiterPostForSavedPost } from "@/services/recruiter/quality-service";
import { regeneratePostFromOpportunity } from "@/services/recruiter/generation";

// ─── Result Types ────────────────────────────────────────────────────────────

export type PostActionResult =
  | {
      success: true;
      post: GeneratedPostRow;
      /** Freshly reassessed report for opportunity-backed posts (Phase 5D). */
      quality?: RecruiterQualityReport | null;
    }
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

    // Phase 5D: edits to an opportunity-backed post are re-evaluated so the
    // reviewer always sees the report for the current text, never a stale one.
    let quality: RecruiterQualityReport | null = null;
    if (post.opportunity_id) {
      const evaluated = await evaluateRecruiterPostForSavedPost(postId);
      quality = evaluated?.report ?? null;
    }

    return { success: true, post, quality };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update post.";
    const code = err instanceof Error && "code" in err ? (err as { code: string }).code : "UNKNOWN";
    return { success: false, error: { code, message } };
  }
}

export async function approvePost(postId: string): Promise<PostActionResult> {
  try {
    const post = await getGeneratedPost(postId);
    if (!post) {
      return {
        success: false,
        error: { code: "POST_NOT_FOUND", message: "Post not found." },
      };
    }

    // Phase 5D quality gate: recruiter (opportunity-backed) posts are always
    // re-evaluated at approval time. A stored/tampered report is never trusted;
    // any critical warning (e.g. unsupported personal claim) or score < 55
    // blocks approval — the quality score can never override evidence safety.
    if (post.opportunity_id) {
      const evaluated = await evaluateRecruiterPostForSavedPost(postId);
      const gate = evaluateApproveGate(evaluated?.report);
      if (!gate.allowed) {
        return {
          success: false,
          error: { code: gate.code, message: gate.message },
        };
      }
    }

    const approved = await changeGeneratedPostStatus(postId, "approved" as GeneratedPostStatus);

    // Phase 5E: keep the workspace card in sync. An approved draft moves its
    // opportunity from "generated" → "approved" so the card offers "Publish
    // to LinkedIn". Best-effort: the post is already approved.
    if (post.opportunity_id) {
      try {
        await updateContentOpportunityStatus(post.opportunity_id, "approved");
      } catch {
        // Opportunity sync must never fail the approval.
      }
    }

    return { success: true, post: approved };
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

/**
 * Phase 5D regeneration of an opportunity-backed post: produces a NEW draft
 * from the same opportunity + evidence + format and re-evaluates its quality.
 * Intended to be triggered by the reviewer when the current candidate needs a
 * different take — never by automation.
 */
export async function regenerateOpportunityPost(
  opportunityId: string,
): Promise<PostActionResult> {
  try {
    const result = await regeneratePostFromOpportunity(opportunityId);
    if (!result.ok) {
      return {
        success: false,
        error: { code: result.code, message: result.message },
      };
    }
    let quality: RecruiterQualityReport | null = null;
    if (result.post.opportunity_id) {
      const evaluated = await evaluateRecruiterPostForSavedPost(result.post.id);
      quality = evaluated?.report ?? null;
    }
    return { success: true, post: result.post, quality };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to regenerate post.";
    return { success: false, error: { code: "GENERATION_FAILED", message } };
  }
}

/**
 * Maps raw LinkedIn provider failures to display-safe messages (Phase 5E).
 * Clients never see provider responses or tokens — only one of these codes.
 */
function mapLinkedInFailure(raw: string | undefined): {
  code: string;
  message: string;
} {
  if (raw === "INSUFFICIENT_SCOPE") {
    return {
      code: "INSUFFICIENT_SCOPE",
      message:
        "LinkedIn connection needs additional permissions to publish. Please reconnect with publishing permissions.",
    };
  }
  if (/login|(401)|invalid token|unauthorized/i.test(raw ?? "")) {
    return {
      code: "LINKEDIN_TOKEN_INVALID",
      message:
        "Your LinkedIn connection is no longer valid. Please reconnect.",
    };
  }
  if (/\(403\)|forbidden|scope/i.test(raw ?? "")) {
    return {
      code: "INSUFFICIENT_SCOPE",
      message:
        "LinkedIn has not granted permission to publish. Reconnect your account with publishing permissions.",
    };
  }
  if (/\(429\)|rate\s*lim/i.test(raw ?? "")) {
    return {
      code: "LINKEDIN_RATE_LIMITED",
      message:
        "LinkedIn is rate-limiting requests right now. Please try again in a few minutes.",
    };
  }
  if (/(\(5\d{2}\)|5\d{2})/.test(raw ?? "")) {
    return {
      code: "LINKEDIN_UNAVAILABLE",
      message:
        "LinkedIn is temporarily unavailable. Please try again shortly.",
    };
  }
  if (/network error|failed to fetch|fetch failed/i.test(raw ?? "")) {
    return {
      code: "LINKEDIN_UNREACHABLE",
      message:
        "Unable to reach LinkedIn. Check your connection and try again.",
    };
  }
  return {
    code: "PUBLISH_FAILED",
    message: "LinkedIn publishing failed. Please try again.",
  };
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

    // 1b. Idempotency: an already-published post returns its existing result.
    if (post.status === "published") {
      return { success: true, post };
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

    // 2b. Phase 5D gate is re-checked at publish time, never bypassed. A
    // freshly edited (or regenerated) draft is always re-evaluated on the
    // server before the LinkedIn call.
    if (post.opportunity_id) {
      const evaluated = await evaluateRecruiterPostForSavedPost(postId);
      const gate = evaluateApproveGate(evaluated?.report);
      if (!gate.allowed) {
        return {
          success: false,
          error: { code: gate.code, message: gate.message },
        };
      }
    }

    // Verify the authenticated user session
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

    // 3. Get the LinkedIn access token (server-side only).
    // The token column is readable only via the service-role client (the
    // hardening migration revokes table-level SELECT of linkedin_connections
    // from authenticated), so use the admin client — matching the scheduler
    // publish path. Ownership is enforced by the post lookup in step 1.
    const adminClient = createAdminClient();
    const tokenData = await getAccessToken(adminClient, user.id);

    if (!tokenData) {
      // Phase 5E: distinguish an expired token from a missing connection.
      const connectionInfo = await getConnectionStatus(adminClient, user.id);
      if (connectionInfo.status === "expired") {
        return {
          success: false,
          error: {
            code: "LINKEDIN_TOKEN_EXPIRED",
            message: "Your LinkedIn connection has expired. Please reconnect.",
          },
        };
      }
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

    // 5. Build the member URN and publish (attach the generated image when one exists)
    const memberUrn = buildMemberUrn(tokenData.linkedinSub);
    const image = await loadPostImage(adminClient, post.id, user.id);
    const result = image
      ? await publishToLinkedIn(tokenData.token, post, memberUrn, image)
      : await publishToLinkedIn(tokenData.token, post, memberUrn);

    // 6. Update the post based on the result
    if (result.success && result.linkedinPostId) {
      const updatedPost = await updatePublishState(postId, {
        status: "published",
        linkedin_post_id: result.linkedinPostId,
        published_at: new Date().toISOString(),
        publish_error: null,
      });

      // Phase 5E: sync the workspace card (approved → published). Best-effort.
      if (post.opportunity_id) {
        try {
          await updateContentOpportunityStatus(post.opportunity_id, "published");
        } catch {
          // The post is already live; the card shows the post's own status.
        }
      }

      return { success: true, post: updatedPost };
    }

    // Publishing failed — store a display-safe mapped message, keep as approved.
    const mapped = mapLinkedInFailure(result.error);
    await updatePublishState(postId, {
      publish_error: mapped.message,
    });

    return {
      success: false,
      error: mapped,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to publish post.";
    const code = err instanceof Error && "code" in err ? (err as { code: string }).code : "PUBLISH_FAILED";
    const mapped = mapLinkedInFailure(`${code} ${message}`);
    return { success: false, error: { code: mapped.code, message: mapped.message } };
  }
}
