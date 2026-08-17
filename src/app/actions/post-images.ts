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
 * Generates a branded image for a generated post.
 */
export async function generatePostImageAction(
  postId: string,
): Promise<ImageActionResult> {
  try {
    const asset = await generatePostImage(postId);
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
 * Regenerates an image for a post with an optional template override.
 */
export async function regeneratePostImageAction(
  postId: string,
  template?: ImageTemplate,
): Promise<ImageActionResult> {
  try {
    const asset = await regeneratePostImage(postId, template);
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
