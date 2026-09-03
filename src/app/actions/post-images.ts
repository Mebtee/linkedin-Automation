"use server";

import type { MediaAssetRow, ImageTemplate } from "@/types/image";
import {
  generatePostImage,
  getPostImage,
  regeneratePostImage,
} from "@/services/image/service";

// ─── Result Types ────────────────────────────────────────────────────────────

export type ImageActionResult =
  | { success: true; asset: MediaAssetRow }
  | { success: false; error: { code: string; message: string } };

export type ImageGetResult =
  | { success: true; asset: MediaAssetRow | null }
  | { success: false; error: { code: string; message: string } };

// ─── Server Actions ──────────────────────────────────────────────────────────

/**
 * Generates an image for a generated post using the active provider, or the
 * requested provider override ("gemini-image" for the AI provider).
 */
export async function generatePostImageAction(
  postId: string,
  provider?: "gemini-image" | "branded-svg",
): Promise<ImageActionResult> {
  try {
    const asset = await generatePostImage(postId, provider);
    return { success: true, asset };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate image.";
    const code = err instanceof Error && "code" in err
      ? (err as { code: string }).code
      : "IMAGE_GENERATION_FAILED";
    return { success: false, error: { code, message } };
  }
}

/**
 * Regenerates an image for a post with an optional template override and
 * optional provider override.
 */
export async function regeneratePostImageAction(
  postId: string,
  template?: ImageTemplate,
  provider?: "gemini-image" | "branded-svg",
): Promise<ImageActionResult> {
  try {
    const asset = await regeneratePostImage(postId, template, provider);
    return { success: true, asset };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to regenerate image.";
    const code = err instanceof Error && "code" in err
      ? (err as { code: string }).code
      : "IMAGE_GENERATION_FAILED";
    return { success: false, error: { code, message } };
  }
}

/**
 * Gets the media asset for a generated post.
 */
export async function getPostImageAction(
  postId: string,
): Promise<ImageGetResult> {
  try {
    const asset = await getPostImage(postId);
    return { success: true, asset };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load image.";
    const code = err instanceof Error && "code" in err
      ? (err as { code: string }).code
      : "IMAGE_NOT_FOUND";
    return { success: false, error: { code, message } };
  }
}
