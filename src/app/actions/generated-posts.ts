"use server";

import {
  getGeneratedPost,
  getGeneratedPostHistory,
  updateGeneratedPost,
  changeGeneratedPostStatus,
  deleteGeneratedPost,
} from "@/services/generated-posts";
import { generatePostForDay } from "@/services/ai/generation";
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
