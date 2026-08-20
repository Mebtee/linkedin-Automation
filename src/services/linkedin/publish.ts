import "server-only";

import type { GeneratedPostRow } from "@/types/generated-post";

// ─── Types ──────────────────────────────────────────────────────────────────

export type LinkedInPublishResult = {
  readonly success: boolean;
  readonly linkedinPostId?: string;
  readonly error?: string;
};

// ─── LinkedIn UGC Post API ──────────────────────────────────────────────────

const LINKEDIN_UGC_POST_URL = "https://api.linkedin.com/v2/ugcPosts";

type LinkedInUGCText = {
  readonly text: string;
};

type LinkedInUGCPost = {
  readonly author: string;
  readonly lifecycleState: "PUBLISHED";
  readonly specificContent: {
    readonly "com.linkedin.ugc.ShareContent": {
      readonly shareCommentary: LinkedInUGCText;
      readonly shareMediaCategory: "NONE";
    };
  };
  readonly visibility: {
    readonly "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC";
  };
};

type LinkedInErrorResponse = {
  readonly status?: number;
  readonly message?: string;
  readonly error_code?: string;
  readonly error_detail?: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Formats a generated post into LinkedIn-compatible text.
 * Combines opening, body, takeaway, next step, and hashtags.
 */
function formatPostText(post: GeneratedPostRow): string {
  const sections: string[] = [];

  sections.push(post.opening);
  sections.push("");
  sections.push(post.body);
  sections.push("");
  sections.push(post.takeaway);

  if (post.next_step) {
    sections.push("");
    sections.push(`Next: ${post.next_step}`);
  }

  if (post.hashtags.length > 0) {
    sections.push("");
    sections.push(post.hashtags.join(" "));
  }

  return sections.join("\n");
}

// ─── Publish ────────────────────────────────────────────────────────────────

/**
 * Publishes a generated post to LinkedIn using the UGC Posts API.
 *
 * Requirements:
 * - The access token must have `w_member_social` scope.
 * - The token must not be expired.
 *
 * The post text is constructed from the structured post fields.
 * This function does NOT modify the database — the caller is responsible
 * for updating the post status and storing the LinkedIn post ID.
 */
export async function publishToLinkedIn(
  accessToken: string,
  post: GeneratedPostRow,
  memberUrn: string,
): Promise<LinkedInPublishResult> {
  const text = formatPostText(post);

  // LinkedIn has a 3000 character limit
  const truncatedText =
    text.length > 3000 ? text.slice(0, 2997) + "..." : text;

  const ugcPost: LinkedInUGCPost = {
    author: memberUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: truncatedText },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  try {
    const response = await fetch(LINKEDIN_UGC_POST_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(ugcPost),
    });

    if (!response.ok) {
      const errorBody = (await response.json()) as LinkedInErrorResponse;

      // Check for insufficient scope
      if (
        errorBody.error_code === "SCOPES_INSUFFICIENT" ||
        errorBody.error_detail?.includes("w_member_social") ||
        response.status === 403
      ) {
        return {
          success: false,
          error: "INSUFFICIENT_SCOPE",
        };
      }

      return {
        success: false,
        error: `LinkedIn API error (${response.status}): ${errorBody.message ?? errorBody.error_detail ?? "Unknown error"}`,
      };
    }

    const data = (await response.json()) as Record<string, unknown>;
    const linkedinPostId = data.id as string | undefined;

    if (!linkedinPostId) {
      return {
        success: false,
        error: "LinkedIn returned success but no post ID.",
      };
    }

    return {
      success: true,
      linkedinPostId,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error";
    return {
      success: false,
      error: `Network error: ${message}`,
    };
  }
}
