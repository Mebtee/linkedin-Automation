import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { AppError } from "@/lib/utils/errors";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("./index", () => ({
  getTextGenerationProvider: vi.fn(),
}));

vi.mock("./validation", () => ({
  validateGeneratedPostPayload: vi.fn(),
}));

vi.mock("@/services/generated-posts/hashing", () => ({
  createContentHash: vi.fn(() => "mock-hash-abc123"),
}));

vi.mock("@/services/generated-posts", () => ({
  createGeneratedPost: vi.fn(),
  checkDuplicatePost: vi.fn(),
}));

// ─── Imports after mocks ────────────────────────────────────────────────────

import { generatePostForDay } from "./generation";
import { createClient } from "@/lib/supabase/server";
import { getTextGenerationProvider } from "./index";
import { validateGeneratedPostPayload } from "./validation";
import { createContentHash } from "@/services/generated-posts/hashing";
import { createGeneratedPost, checkDuplicatePost } from "@/services/generated-posts";

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const mockUser = { id: "user-123" };

const mockCurriculumDay = {
  id: "day-uuid-1",
  day_number: 1,
  module_id: "module-uuid-1",
  week_number: 1,
  topic: "Git and Terminal Basics",
  content: "Learn to use Git",
  subtopics: ["git init", "git add"],
  project_information: null,
  assessment_information: null,
  created_at: "2026-08-17T00:00:00Z",
  updated_at: "2026-08-17T00:00:00Z",
};

const mockModule = {
  module_number: 1,
  title: "Foundation: Git, Terminal, Python, OOP & DSA",
};

const mockJournal = {
  id: "journal-uuid-1",
  profile_id: "user-123",
  day_number: 1,
  status: "submitted",
  what_i_learned: "I learned git",
  what_i_practiced: "Practiced commits",
  what_i_built: null,
  challenge: "Forgot commands",
  how_i_solved_it: "Made a cheat sheet",
  key_takeaway: "Git saves versions",
  tomorrow_focus: "Learn branches",
  project_name: null,
  project_description: null,
  code_reference: null,
  resources_used: "FreeCodeCamp",
  confidence_level: 3,
  additional_notes: null,
  created_at: "2026-08-17T10:00:00Z",
  updated_at: "2026-08-17T10:00:00Z",
};

const mockProviderResult = {
  payload: {
    post: {
      opening: "Today I learned about Git.",
      body: "Git helps track changes in code.",
      takeaway: "Git is powerful.",
      nextStep: "Learn branches.",
      hashtags: ["#105DaysOfCode", "#Git"],
    },
    image: {
      headline: "Learning Git",
      subheadline: "Git and Terminal Basics",
      keywords: ["git", "terminal"],
      visualConcept: "Learning Git",
      template: "learner-progress",
    },
  },
  metadata: {
    provider: "fallback",
    model: "template-v1",
    generatedAt: "2026-08-17T10:00:00Z",
  },
};

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
  content_hash: "mock-hash-abc123",
  created_at: "2026-08-17T10:00:00Z",
  updated_at: "2026-08-17T10:00:00Z",
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("generatePostForDay", () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  function createMockSupabase() {
    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn(),
    };
  }

  function setupDefaultMocks() {
    // Default: all DB queries succeed
    mockSupabase.from.mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };

      if (table === "curriculum_days") {
        chain.single.mockResolvedValue({ data: mockCurriculumDay, error: null });
      } else if (table === "modules") {
        chain.single.mockResolvedValue({ data: mockModule, error: null });
      } else if (table === "daily_learning_entries") {
        chain.single.mockResolvedValue({ data: mockJournal, error: null });
      } else if (table === "generated_posts") {
        chain.single.mockResolvedValue({ data: mockSavedPost, error: null });
      }

      return chain;
    });

    // Default: validation passes through
    (validateGeneratedPostPayload as Mock).mockImplementation(
      (output: unknown) => output,
    );

    // Default: provider returns valid result
    (getTextGenerationProvider as Mock).mockReturnValue({
      generatePost: vi.fn().mockResolvedValue(mockProviderResult),
    });

    // Default: not a duplicate
    (checkDuplicatePost as Mock).mockResolvedValue(false);

    // Default: create returns saved post (mimics DB returning the inserted row)
    (createGeneratedPost as Mock).mockImplementation(
      (input: Record<string, unknown>) =>
        Promise.resolve({ ...mockSavedPost, ...input, id: "post-uuid-1" }),
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    (createClient as Mock).mockResolvedValue(mockSupabase);
    setupDefaultMocks();
  });

  // ─── Auth ───────────────────────────────────────────────────────────────

  it("rejects unauthenticated user", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

    await expect(generatePostForDay(1)).rejects.toThrow(AppError);
    try {
      await generatePostForDay(1);
    } catch (e) {
      expect((e as AppError).code).toBe("GENERATION_UNAUTHORIZED");
    }
  });

  it("allows authenticated user", async () => {
    const post = await generatePostForDay(1);
    expect(post).toBeDefined();
    expect(post.id).toBe("post-uuid-1");
  });

  // ─── Day Validation ─────────────────────────────────────────────────────

  it("accepts day 1", async () => {
    const post = await generatePostForDay(1);
    expect(post.day_number).toBe(1);
  });

  it("accepts day 105", async () => {
    // Override the `from` mock for this test only
    mockSupabase.from.mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };

      if (table === "curriculum_days") {
        chain.single.mockResolvedValue({ data: { ...mockCurriculumDay, day_number: 105 }, error: null });
      } else if (table === "modules") {
        chain.single.mockResolvedValue({ data: mockModule, error: null });
      } else if (table === "daily_learning_entries") {
        chain.single.mockResolvedValue({ data: { ...mockJournal, day_number: 105 }, error: null });
      }

      return chain;
    });

    (createGeneratedPost as Mock).mockResolvedValue({
      ...mockSavedPost,
      day_number: 105,
    });

    const post = await generatePostForDay(105);
    expect(post.day_number).toBe(105);
  });

  it("rejects day 0", async () => {
    await expect(generatePostForDay(0)).rejects.toThrow(AppError);
  });

  it("rejects day 106", async () => {
    await expect(generatePostForDay(106)).rejects.toThrow(AppError);
  });

  it("rejects negative day", async () => {
    await expect(generatePostForDay(-1)).rejects.toThrow(AppError);
  });

  // ─── Curriculum ─────────────────────────────────────────────────────────

  it("rejects missing curriculum day", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };

      if (table === "curriculum_days") {
        // Return valid but empty curriculum so it passes day validation, then returns not found
        chain.single.mockResolvedValue({ data: null, error: { message: "not found" } });
      } else if (table === "modules") {
        chain.single.mockResolvedValue({ data: mockModule, error: null });
      } else if (table === "daily_learning_entries") {
        chain.single.mockResolvedValue({ data: mockJournal, error: null });
      }

      return chain;
    });

    await expect(generatePostForDay(1)).rejects.toThrow(AppError);
    try {
      await generatePostForDay(1);
    } catch (e) {
      expect((e as AppError).code).toBe("CURRICULUM_NOT_FOUND");
    }
  });

  // ─── Journal ────────────────────────────────────────────────────────────

  it("rejects missing journal entry", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };

      if (table === "curriculum_days") {
        chain.single.mockResolvedValue({ data: mockCurriculumDay, error: null });
      } else if (table === "modules") {
        chain.single.mockResolvedValue({ data: mockModule, error: null });
      } else if (table === "daily_learning_entries") {
        chain.single.mockResolvedValue({ data: null, error: { message: "not found" } });
      }

      return chain;
    });

    await expect(generatePostForDay(1)).rejects.toThrow(AppError);
    try {
      await generatePostForDay(1);
    } catch (e) {
      expect((e as AppError).code).toBe("JOURNAL_NOT_FOUND");
    }
  });

  it("rejects draft journal", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };

      if (table === "curriculum_days") {
        chain.single.mockResolvedValue({ data: mockCurriculumDay, error: null });
      } else if (table === "modules") {
        chain.single.mockResolvedValue({ data: mockModule, error: null });
      } else if (table === "daily_learning_entries") {
        chain.single.mockResolvedValue({ data: { ...mockJournal, status: "draft" }, error: null });
      }

      return chain;
    });

    await expect(generatePostForDay(1)).rejects.toThrow(AppError);
    try {
      await generatePostForDay(1);
    } catch (e) {
      expect((e as AppError).code).toBe("JOURNAL_NOT_SUBMITTED");
    }
  });

  it("accepts submitted journal", async () => {
    const post = await generatePostForDay(1);
    expect(post).toBeDefined();
  });

  it("links generated post to correct journal entry", async () => {
    await generatePostForDay(1);

    expect(createGeneratedPost).toHaveBeenCalledWith(
      expect.objectContaining({
        journal_entry_id: "journal-uuid-1",
      }),
    );
  });

  // ─── Format ─────────────────────────────────────────────────────────────

  it("uses explicit format when provided", async () => {
    await generatePostForDay(1, "challenge");

    expect(createGeneratedPost).toHaveBeenCalledWith(
      expect.objectContaining({
        format: "challenge",
      }),
    );
  });

  it("uses default format when not provided", async () => {
    await generatePostForDay(1);

    // Day 1 → what-i-learned
    expect(createGeneratedPost).toHaveBeenCalledWith(
      expect.objectContaining({
        format: "what-i-learned",
      }),
    );
  });

  // ─── Provider ───────────────────────────────────────────────────────────

  it("calls provider exactly once", async () => {
    const mockGenerate = vi.fn().mockResolvedValue(mockProviderResult);
    (getTextGenerationProvider as Mock).mockReturnValue({ generatePost: mockGenerate });

    await generatePostForDay(1);

    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("handles provider failure", async () => {
    const mockGenerate = vi.fn().mockRejectedValue(new Error("API error"));
    (getTextGenerationProvider as Mock).mockReturnValue({ generatePost: mockGenerate });

    await expect(generatePostForDay(1)).rejects.toThrow(AppError);
    try {
      await generatePostForDay(1);
    } catch (e) {
      expect((e as AppError).code).toBe("GENERATION_FAILED");
    }
  });

  it("handles invalid provider output", async () => {
    (validateGeneratedPostPayload as Mock).mockImplementation(() => {
      throw new AppError("Invalid output", { code: "INVALID_OUTPUT" });
    });

    await expect(generatePostForDay(1)).rejects.toThrow(AppError);
  });

  // ─── Output Validation ──────────────────────────────────────────────────

  it("validates provider output", async () => {
    await generatePostForDay(1);

    expect(validateGeneratedPostPayload).toHaveBeenCalledWith(mockProviderResult.payload);
  });

  // ─── Duplicates ─────────────────────────────────────────────────────────

  it("rejects duplicate content", async () => {
    (checkDuplicatePost as Mock).mockResolvedValue(true);

    await expect(generatePostForDay(1)).rejects.toThrow(AppError);
    try {
      await generatePostForDay(1);
    } catch (e) {
      expect((e as AppError).code).toBe("GENERATION_DUPLICATE");
    }
  });

  it("allows different content for same day", async () => {
    (checkDuplicatePost as Mock).mockResolvedValue(false);

    const post = await generatePostForDay(1);
    expect(post).toBeDefined();
  });

  // ─── Persistence ────────────────────────────────────────────────────────

  it("persists correct day number", async () => {
    await generatePostForDay(1);

    expect(createGeneratedPost).toHaveBeenCalledWith(
      expect.objectContaining({
        day_number: 1,
      }),
    );
  });

  it("persists correct provider metadata", async () => {
    await generatePostForDay(1);

    expect(createGeneratedPost).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "fallback",
        model: "template-v1",
      }),
    );
  });

  it("persists content hash", async () => {
    await generatePostForDay(1);

    expect(createGeneratedPost).toHaveBeenCalledWith(
      expect.objectContaining({
        content_hash: "mock-hash-abc123",
      }),
    );
    expect(createContentHash).toHaveBeenCalled();
  });

  it("persists image metadata", async () => {
    await generatePostForDay(1);

    expect(createGeneratedPost).toHaveBeenCalledWith(
      expect.objectContaining({
        image_headline: "Learning Git",
        image_subheadline: "Git and Terminal Basics",
        image_keywords: ["git", "terminal"],
        image_visual_concept: "Learning Git",
        image_template: "learner-progress",
      }),
    );
  });

  it("returns saved post", async () => {
    const post = await generatePostForDay(1);
    expect(post).toEqual(mockSavedPost);
  });
});
