"use server";

import type { PostFormat } from "@/types/ai";
import type { GeneratedPostRow } from "@/types/generated-post";
import { generatePostForDay } from "@/services/ai/generation";

// ─── Result Type ─────────────────────────────────────────────────────────────

export type GeneratePostResult =
  | {
      success: true;
      post: GeneratedPostRow;
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
      };
    };

// ─── Input Type ──────────────────────────────────────────────────────────────

export type GeneratePostInput = {
  dayNumber: number;
  format?: PostFormat;
};

// ─── Server Action ───────────────────────────────────────────────────────────

/**
 * Server Action: Generate a LinkedIn post for a specific day.
 *
 * This is a thin wrapper around the generation service.
 * All business logic lives in the service layer.
 */
export async function generatePost(input: GeneratePostInput): Promise<GeneratePostResult> {
  try {
    const post = await generatePostForDay(input.dayNumber, input.format);
    return { success: true, post };
  } catch (err) {
    const code = err instanceof Error && "code" in err
      ? (err as { code: string }).code
      : "GENERATION_FAILED";
    const message = err instanceof Error
      ? err.message
      : "Failed to generate post.";

    return {
      success: false,
      error: { code, message },
    };
  }
}
