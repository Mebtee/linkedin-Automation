import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { GeneratedPostRow } from "@/types/generated-post";
import { content } from "@/config/content";

// ─── Types ──────────────────────────────────────────────────────────────────

export type LinkedInPublishResult = {
  readonly success: boolean;
  readonly linkedinPostId?: string;
  readonly error?: string;
};

/**
 * A ready-to-upload image for a LinkedIn post. Bytes may be SVG (rasterized
 * to PNG before upload — LinkedIn does not accept SVG) or an already-bitmap
 * format such as PNG/JPEG.
 */
export type LinkedInImageInput = {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
  readonly altText: string;
};

// ─── LinkedIn UGC Post API ──────────────────────────────────────────────────

const LINKEDIN_UGC_POST_URL = "https://api.linkedin.com/v2/ugcPosts";
const LINKEDIN_ASSETS_REGISTER_URL = "https://api.linkedin.com/v2/assets?action=registerUpload";
const LINKEDIN_IMAGE_RECIPE = "urn:li:digitalmediaRecipe:feedshare-image";

type LinkedInUGCText = {
  readonly text: string;
};

type LinkedInUGCMediaItem = {
  readonly status: "READY";
  readonly description: LinkedInUGCText;
  readonly media: string;
};

type LinkedInUGCPost = {
  readonly author: string;
  readonly lifecycleState: "PUBLISHED";
  readonly specificContent: {
    readonly "com.linkedin.ugc.ShareContent": {
      readonly shareCommentary: LinkedInUGCText;
      readonly shareMediaCategory: "NONE" | "IMAGE";
      readonly media?: readonly LinkedInUGCMediaItem[];
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

type MediaUploadHttpRequest = {
  readonly uploadUrl?: string | null;
  readonly headers?: Record<string, string>;
};

type RegisterUploadResponse = {
  readonly value?: {
    readonly uploadUrn?: string | null;
    readonly uploadUrl?: string | null;
    readonly asset?: string | null;
    readonly uploadMechanism?: {
      readonly "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"?: MediaUploadHttpRequest;
    };
  };
};

type RegisterUploadSuccess = {
  readonly uploadUrl: string;
  readonly asset: string;
  readonly headers?: Readonly<Record<string, string>>;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Formats a generated post into LinkedIn-compatible text.
 * Combines opening, body, takeaway, the portfolio link, and hashtags.
 * The "next step" is intentionally NOT published — it is internal planning,
 * not part of the post viewers should see.
 */
function formatPostText(post: GeneratedPostRow): string {
  const sections: string[] = [];

  sections.push(post.opening);
  sections.push("");
  sections.push(post.body);
  sections.push("");
  sections.push(post.takeaway);

  if (content.portfolio.url) {
    sections.push("");
    sections.push(`${content.portfolio.label} ${content.portfolio.url}`);
  }

  if (post.hashtags.length > 0) {
    sections.push("");
    sections.push(post.hashtags.join(" "));
  }

  return sections.join("\n");
}

/**
 * Determines whether a LinkedIn API error means the token lacks the required
 * `w_member_social` scope.
 */
function isInsufficientScope(
  status: number,
  body: LinkedInErrorResponse,
): boolean {
  return (
    body.error_code === "SCOPES_INSUFFICIENT" ||
    body.error_detail?.includes("w_member_social") ||
    status === 403
  );
}

/**
 * Rasterizes an SVG image to PNG. LinkedIn post images must be JPEG, PNG, or
 * GIF; SVG is never accepted. Already-bitmap inputs pass through unchanged.
 */
async function rasterizeToPng(
  input: LinkedInImageInput,
): Promise<{ readonly bytes: Uint8Array; readonly mimeType: "image/png" }> {
  if (input.mimeType !== "image/svg+xml") {
    return { bytes: input.bytes, mimeType: "image/png" };
  }

  const sharp = (await import("sharp")).default;
  const png = await sharp(Buffer.from(input.bytes)).png().toBuffer();
  return { bytes: new Uint8Array(png), mimeType: "image/png" };
}

/**
 * Registers an image upload with the LinkedIn Assets API, returning the
 * pre-signed upload URL and the asset URN to reference in the post.
 *
 * LinkedIn returns the upload URL in one of two shapes depending on the
 * recipe/token vintage:
 * - Legacy: `value.uploadUrl`
 * - Current: `value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl`
 * Both are tolerated so either vintage can upload and publish.
 */
async function registerImageUpload(
  accessToken: string,
  ownerUrn: string,
): Promise<RegisterUploadSuccess> {
  const response = await fetch(LINKEDIN_ASSETS_REGISTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: [LINKEDIN_IMAGE_RECIPE],
        owner: ownerUrn,
        serviceRelationships: [
          {
            relationshipType: "OWNER",
            identifier: "urn:li:userGeneratedContent",
          },
        ],
      },
    }),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as LinkedInErrorResponse;
    if (isInsufficientScope(response.status, errorBody)) {
      throw Object.assign(new Error("INSUFFICIENT_SCOPE"), { code: "INSUFFICIENT_SCOPE" });
    }
    throw new Error(
      `LinkedIn image registration failed (${response.status}): ${errorBody.message ?? errorBody.error_detail ?? "Unknown error"}`,
    );
  }

  const data = (await response.json()) as RegisterUploadResponse;
  const mechanism = data.value?.uploadMechanism?.[
    "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
  ];
  const uploadUrl =
    data.value?.uploadUrl ?? mechanism?.uploadUrl ?? undefined;
  const asset = data.value?.asset;
  const headers = mechanism?.headers;

  if (!uploadUrl || !asset) {
    // Surface a snippet of the response so the raw payload is available in
    // server logs when LinkedIn changes the response shape again.
    throw new Error(
      `LinkedIn image registration did not return an upload URL or asset URN. Response: ${JSON.stringify(data).slice(0, 500)}`,
    );
  }

  return { uploadUrl, asset, headers };
}

/**
 * Uploads the image bytes to the pre-signed upload URL provided by LinkedIn.
 * Uses any headers supplied by LinkedIn's upload mechanism, falling back to
 * the image's own content type when none are given.
 */
async function uploadImageBytes(
  uploadUrl: string,
  image: { readonly bytes: Uint8Array; readonly mimeType: string },
  extraHeaders?: Readonly<Record<string, string>>,
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Length": image.bytes.byteLength.toString(),
    ...(extraHeaders ?? {}),
  };
  if (!headers["Content-Type"]) {
    headers["Content-Type"] = image.mimeType;
  }

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers,
    body: image.bytes.buffer as ArrayBuffer,
  });

  if (!response.ok) {
    throw new Error(`LinkedIn image upload failed (${response.status}).`);
  }
}

/**
 * Loads the generated image for a post from Supabase Storage, ready to be
 * attached to a LinkedIn post. Returns null when the post has no image.
 *
 * The caller must pass a service-role client so that storage downloads are
 * not restricted by the bucket's public-read policies.
 */
export async function loadPostImage(
  supabase: SupabaseClient,
  postId: string,
  profileId: string,
): Promise<LinkedInImageInput | null> {
  const { data: asset } = await supabase
    .from("media_assets")
    .select("storage_path, mime_type, alt_text")
    .eq("generated_post_id", postId)
    .eq("profile_id", profileId)
    .single();

  if (!asset) return null;

  const { data: blob, error } = await supabase.storage
    .from("post-images")
    .download(asset.storage_path);

  if (error || !blob) return null;

  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    mimeType: asset.mime_type,
    altText: asset.alt_text,
  };
}

// ─── Publish ────────────────────────────────────────────────────────────────

/**
 * Publishes a generated post to LinkedIn using the UGC Posts API.
 *
 * Requirements:
 * - The access token must have `w_member_social` scope.
 * - The token must not be expired.
 *
 * The post text is constructed from the structured post fields. When an
 * `image` is provided it is rasterized (SVG → PNG) and attached via the
 * LinkedIn Assets API; otherwise a text-only post is published.
 *
 * This function does NOT modify the database — the caller is responsible
 * for updating the post status and storing the LinkedIn post ID.
 */
export async function publishToLinkedIn(
  accessToken: string,
  post: GeneratedPostRow,
  memberUrn: string,
  image?: LinkedInImageInput,
): Promise<LinkedInPublishResult> {
  const text = formatPostText(post);

  // LinkedIn has a 3000 character limit
  const truncatedText =
    text.length > 3000 ? text.slice(0, 2997) + "..." : text;

  try {
    // Optionally attach an image: register the upload, push the bytes, and
    // reference the returned asset URN in the post.
    let shareMediaCategory: "NONE" | "IMAGE" = "NONE";
    let media: readonly LinkedInUGCMediaItem[] | undefined;

    if (image) {
      const rasterized = await rasterizeToPng(image);
      const { uploadUrl, asset, headers } = await registerImageUpload(
        accessToken,
        memberUrn,
      );
      await uploadImageBytes(uploadUrl, rasterized, headers);
      shareMediaCategory = "IMAGE";
      media = [
        {
          status: "READY",
          description: { text: image.altText },
          media: asset,
        },
      ];
    }

    const ugcPost: LinkedInUGCPost = {
      author: memberUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: truncatedText },
          shareMediaCategory,
          ...(media ? { media } : {}),
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

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
      if (isInsufficientScope(response.status, errorBody)) {
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

    // Preserve the scope-detection signal from the image registration path.
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "INSUFFICIENT_SCOPE"
    ) {
      return { success: false, error: "INSUFFICIENT_SCOPE" };
    }

    return {
      success: false,
      error: `Network error: ${message}`,
    };
  }
}