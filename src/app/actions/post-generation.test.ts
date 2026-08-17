import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { AppError } from "@/lib/utils/errors";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/services/ai/generation", () => ({
  generatePostForDay: vi.fn(),
}));

// ─── Imports after mocks ────────────────────────────────────────────────────

import { generatePost } from "./post-generation";
import { generatePostForDay } from "@/services/ai/generation";

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const mockSavedPost = {
  id: "post-uuid-1",
  profile_id: "user-123",
  journal_entry_id: "journal-uuid-1",
  day_number: 1,
  status: "draft",
  format: "what-i-learned",
  opening: "Today I learned about Git.",
  body: "Git helps track changes in code.",
  takeaway: "Git is powerful.",
  next_step: "Learn branches.",
  hashtags: ["#105DaysOfCode", "#Git"],
  image_headline: "Learning Git",
  image_subheadline: "Git and Terminal Basics",
  image_keywords: ["git", "terminal"],
  image_visual_concept: "Learning Git",
  image_template: "learner-progress",
  provider: "fallback",
  model: "template-v1",
  tokens_used: null,
  content_hash: "hash-abc123",
  created_at: "2026-08-17T10:00:00Z",
  updated_at: "2026-08-17T10:00:00Z",
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("generatePost server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success result on valid input", async () => {
    (generatePostForDay as Mock).mockResolvedValue(mockSavedPost);

    const result = await generatePost({ dayNumber: 1 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.post).toEqual(mockSavedPost);
    }
  });

  it("passes format to service", async () => {
    (generatePostForDay as Mock).mockResolvedValue(mockSavedPost);

    await generatePost({ dayNumber: 1, format: "challenge" });

    expect(generatePostForDay).toHaveBeenCalledWith(1, "challenge");
  });

  it("handles missing format as undefined", async () => {
    (generatePostForDay as Mock).mockResolvedValue(mockSavedPost);

    await generatePost({ dayNumber: 1 });

    expect(generatePostForDay).toHaveBeenCalledWith(1, undefined);
  });

  it("returns error result on generation failure", async () => {
    (generatePostForDay as Mock).mockRejectedValue(
      new AppError("Generation failed", { code: "GENERATION_FAILED" }),
    );

    const result = await generatePost({ dayNumber: 1 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("GENERATION_FAILED");
      expect(result.error.message).toBe("Generation failed");
    }
  });

  it("extracts error code from AppError", async () => {
    (generatePostForDay as Mock).mockRejectedValue(
      new AppError("Not submitted", { code: "JOURNAL_NOT_SUBMITTED" }),
    );

    const result = await generatePost({ dayNumber: 1 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("JOURNAL_NOT_SUBMITTED");
    }
  });

  it("handles non-AppError gracefully", async () => {
    (generatePostForDay as Mock).mockRejectedValue("unknown error");

    const result = await generatePost({ dayNumber: 1 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("GENERATION_FAILED");
      expect(result.error.message).toBe("Failed to generate post.");
    }
  });

  it("handles generic Error gracefully", async () => {
    (generatePostForDay as Mock).mockRejectedValue(new Error("Something broke"));

    const result = await generatePost({ dayNumber: 1 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("GENERATION_FAILED");
      expect(result.error.message).toBe("Something broke");
    }
  });

  it("never throws — always returns result type", async () => {
    (generatePostForDay as Mock).mockRejectedValue(new Error("fail"));

    // Should not throw
    const result = await generatePost({ dayNumber: 1 });
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
  });
});
