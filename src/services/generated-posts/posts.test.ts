import { describe, it, expect } from "vitest";
import { AppError } from "@/lib/utils/errors";
import {
  validateDayNumber,
  validatePostFormat,
  validateGeneratedPostStatus,
  validateStatusTransition,
  validateCreateInput,
  validateUpdateInput,
} from "./validation";
import { normalizePostContent, createContentHash } from "./hashing";
import { ALLOWED_POST_STATUS_TRANSITIONS } from "@/types/generated-post";

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const validCreateInput = {
  journal_entry_id: "550e8400-e29b-41d4-a716-446655440000",
  day_number: 1,
  format: "what-i-learned" as const,
  opening: "Today I learned about React hooks.",
  body: "React hooks let you use state in functional components.",
  takeaway: "Hooks make functional components powerful.",
  next_step: "Learn about custom hooks.",
  hashtags: ["#105DaysOfCode", "#React"],
  provider: "fallback",
  model: "template-v1",
  content_hash: "abc123",
};

const validUpdateInput = {
  status: "approved" as const,
  opening: "Updated opening.",
};

// ─── 1. validateDayNumber ───────────────────────────────────────────────────

describe("validateDayNumber", () => {
  it("accepts valid day numbers (1–105)", () => {
    expect(validateDayNumber(1)).toBe(1);
    expect(validateDayNumber(50)).toBe(50);
    expect(validateDayNumber(105)).toBe(105);
  });

  it("rejects day 0", () => {
    expect(() => validateDayNumber(0)).toThrow(AppError);
  });

  it("rejects negative numbers", () => {
    expect(() => validateDayNumber(-1)).toThrow(AppError);
  });

  it("rejects day 106", () => {
    expect(() => validateDayNumber(106)).toThrow(AppError);
  });

  it("rejects 999", () => {
    expect(() => validateDayNumber(999)).toThrow(AppError);
  });

  it("rejects non-integer numbers", () => {
    expect(() => validateDayNumber(1.5)).toThrow(AppError);
  });

  it("rejects non-number values", () => {
    expect(() => validateDayNumber("1")).toThrow(AppError);
    expect(() => validateDayNumber(null)).toThrow(AppError);
    expect(() => validateDayNumber(undefined)).toThrow(AppError);
  });

  it("throws VALIDATION_ERROR code", () => {
    try {
      validateDayNumber(0);
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("VALIDATION_ERROR");
    }
  });
});

// ─── 2. validatePostFormat ──────────────────────────────────────────────────

describe("validatePostFormat", () => {
  it("accepts all valid formats", () => {
    const formats = [
      "what-i-learned",
      "challenge",
      "small-win",
      "project",
      "concept",
      "reflection",
      "practical-lesson",
    ];
    for (const format of formats) {
      expect(validatePostFormat(format)).toBe(format);
    }
  });

  it("rejects invalid format", () => {
    expect(() => validatePostFormat("invalid")).toThrow(AppError);
  });

  it("rejects empty string", () => {
    expect(() => validatePostFormat("")).toThrow(AppError);
  });

  it("rejects non-string values", () => {
    expect(() => validatePostFormat(123)).toThrow(AppError);
    expect(() => validatePostFormat(null)).toThrow(AppError);
    expect(() => validatePostFormat(undefined)).toThrow(AppError);
  });

  it("throws VALIDATION_ERROR code", () => {
    try {
      validatePostFormat("bad");
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("VALIDATION_ERROR");
    }
  });
});

// ─── 3. validateGeneratedPostStatus ─────────────────────────────────────────

describe("validateGeneratedPostStatus", () => {
  it("accepts all valid statuses", () => {
    expect(validateGeneratedPostStatus("draft")).toBe("draft");
    expect(validateGeneratedPostStatus("approved")).toBe("approved");
    expect(validateGeneratedPostStatus("published")).toBe("published");
    expect(validateGeneratedPostStatus("failed")).toBe("failed");
  });

  it("rejects invalid status", () => {
    expect(() => validateGeneratedPostStatus("invalid")).toThrow(AppError);
  });

  it("rejects non-string values", () => {
    expect(() => validateGeneratedPostStatus(123)).toThrow(AppError);
    expect(() => validateGeneratedPostStatus(null)).toThrow(AppError);
  });
});

// ─── 4. validateStatusTransition ────────────────────────────────────────────

describe("validateStatusTransition", () => {
  it("allows draft → approved", () => {
    expect(() => validateStatusTransition("draft", "approved")).not.toThrow();
  });

  it("allows draft → failed", () => {
    expect(() => validateStatusTransition("draft", "failed")).not.toThrow();
  });

  it("allows approved → published", () => {
    expect(() => validateStatusTransition("approved", "published")).not.toThrow();
  });

  it("rejects draft → published", () => {
    expect(() => validateStatusTransition("draft", "published")).toThrow(AppError);
  });

  it("rejects approved → draft", () => {
    expect(() => validateStatusTransition("approved", "draft")).toThrow(AppError);
  });

  it("rejects published → draft", () => {
    expect(() => validateStatusTransition("published", "draft")).toThrow(AppError);
  });

  it("rejects published → approved", () => {
    expect(() => validateStatusTransition("published", "approved")).toThrow(AppError);
  });

  it("rejects published → published", () => {
    expect(() => validateStatusTransition("published", "published")).toThrow(AppError);
  });

  it("rejects failed → any", () => {
    expect(() => validateStatusTransition("failed", "draft")).toThrow(AppError);
    expect(() => validateStatusTransition("failed", "approved")).toThrow(AppError);
    expect(() => validateStatusTransition("failed", "published")).toThrow(AppError);
  });

  it("throws INVALID_STATUS code", () => {
    try {
      validateStatusTransition("published", "draft");
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("INVALID_STATUS");
    }
  });
});

// ─── 5. validateCreateInput ─────────────────────────────────────────────────

describe("validateCreateInput", () => {
  it("accepts valid input", () => {
    const result = validateCreateInput(validCreateInput);
    expect(result.journal_entry_id).toBe(validCreateInput.journal_entry_id);
    expect(result.day_number).toBe(1);
    expect(result.format).toBe("what-i-learned");
  });

  it("rejects null input", () => {
    expect(() => validateCreateInput(null)).toThrow(AppError);
  });

  it("rejects input without journal_entry_id", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { journal_entry_id, ...rest } = validCreateInput;
    expect(() => validateCreateInput({ ...rest })).toThrow("journal_entry_id is required");
  });

  it("rejects input with invalid day_number", () => {
    expect(() => validateCreateInput({ ...validCreateInput, day_number: 0 })).toThrow(AppError);
  });

  it("rejects input with invalid format", () => {
    expect(() => validateCreateInput({ ...validCreateInput, format: "bad" })).toThrow(AppError);
  });

  it("rejects input without opening", () => {
    expect(() => validateCreateInput({ ...validCreateInput, opening: "" })).toThrow("opening is required");
  });

  it("rejects input without body", () => {
    expect(() => validateCreateInput({ ...validCreateInput, body: "" })).toThrow("body is required");
  });

  it("rejects input without takeaway", () => {
    expect(() => validateCreateInput({ ...validCreateInput, takeaway: "" })).toThrow("takeaway is required");
  });

  it("rejects input without next_step", () => {
    expect(() => validateCreateInput({ ...validCreateInput, next_step: "" })).toThrow("next_step is required");
  });

  it("rejects input without hashtags array", () => {
    expect(() => validateCreateInput({ ...validCreateInput, hashtags: "not-array" })).toThrow("hashtags must be an array");
  });

  it("rejects input without provider", () => {
    expect(() => validateCreateInput({ ...validCreateInput, provider: "" })).toThrow("provider is required");
  });

  it("rejects input without model", () => {
    expect(() => validateCreateInput({ ...validCreateInput, model: "" })).toThrow("model is required");
  });

  it("rejects input without content_hash", () => {
    expect(() => validateCreateInput({ ...validCreateInput, content_hash: "" })).toThrow("content_hash is required");
  });
});

// ─── 6. validateUpdateInput ─────────────────────────────────────────────────

describe("validateUpdateInput", () => {
  it("accepts valid update input", () => {
    const result = validateUpdateInput(validUpdateInput);
    expect(result.status).toBe("approved");
    expect(result.opening).toBe("Updated opening.");
  });

  it("accepts empty update (no fields)", () => {
    const result = validateUpdateInput({});
    expect(result).toEqual({});
  });

  it("rejects null input", () => {
    expect(() => validateUpdateInput(null)).toThrow(AppError);
  });

  it("rejects invalid status", () => {
    expect(() => validateUpdateInput({ status: "bad" })).toThrow(AppError);
  });

  it("rejects empty opening string", () => {
    expect(() => validateUpdateInput({ opening: "" })).toThrow("opening must be a non-empty string");
  });

  it("rejects empty body string", () => {
    expect(() => validateUpdateInput({ body: "" })).toThrow("body must be a non-empty string");
  });

  it("rejects non-array hashtags", () => {
    expect(() => validateUpdateInput({ hashtags: "bad" })).toThrow("hashtags must be an array");
  });

  it("rejects empty content_hash", () => {
    expect(() => validateUpdateInput({ content_hash: "" })).toThrow("content_hash must be a non-empty string");
  });
});

// ─── 7. normalizePostContent ────────────────────────────────────────────────

describe("normalizePostContent", () => {
  it("lowercases all fields", () => {
    const result = normalizePostContent({
      opening: "Hello World",
      body: "Some Content",
      takeaway: "Key Point",
      nextStep: "Next Step",
      hashtags: ["#React", "#Code"],
    });
    expect(result).toContain("hello world");
    expect(result).toContain("some content");
    expect(result).toContain("key point");
    expect(result).toContain("next step");
  });

  it("trims whitespace", () => {
    const result = normalizePostContent({
      opening: "  Hello  ",
      body: "  World  ",
      takeaway: "  Key  ",
      nextStep: "  Next  ",
      hashtags: ["  #tag  "],
    });
    expect(result).not.toContain("  ");
  });

  it("sorts hashtags alphabetically", () => {
    const result1 = normalizePostContent({
      opening: "a",
      body: "b",
      takeaway: "c",
      nextStep: "d",
      hashtags: ["#zebra", "#alpha"],
    });
    const result2 = normalizePostContent({
      opening: "a",
      body: "b",
      takeaway: "c",
      nextStep: "d",
      hashtags: ["#alpha", "#zebra"],
    });
    expect(result1).toBe(result2);
  });

  it("uses ||| separator", () => {
    const result = normalizePostContent({
      opening: "a",
      body: "b",
      takeaway: "c",
      nextStep: "d",
      hashtags: [],
    });
    expect(result).toBe("a|||b|||c|||d|||");
  });
});

// ─── 8. createContentHash ──────────────────────────────────────────────────

describe("createContentHash", () => {
  it("returns a 64-character hex string", () => {
    const hash = createContentHash({
      opening: "Hello",
      body: "World",
      takeaway: "Key",
      nextStep: "Next",
      hashtags: ["#tag"],
    });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("same content produces same hash", () => {
    const content = {
      opening: "Today I learned React.",
      body: "React is great.",
      takeaway: "Components are useful.",
      nextStep: "Learn hooks.",
      hashtags: ["#React", "#Code"],
    };
    const hash1 = createContentHash(content);
    const hash2 = createContentHash(content);
    expect(hash1).toBe(hash2);
  });

  it("different content produces different hash", () => {
    const hash1 = createContentHash({
      opening: "Hello",
      body: "World",
      takeaway: "Key",
      nextStep: "Next",
      hashtags: [],
    });
    const hash2 = createContentHash({
      opening: "Goodbye",
      body: "World",
      takeaway: "Key",
      nextStep: "Next",
      hashtags: [],
    });
    expect(hash1).not.toBe(hash2);
  });

  it("different hashtags produce different hash", () => {
    const hash1 = createContentHash({
      opening: "a",
      body: "b",
      takeaway: "c",
      nextStep: "d",
      hashtags: ["#react"],
    });
    const hash2 = createContentHash({
      opening: "a",
      body: "b",
      takeaway: "c",
      nextStep: "d",
      hashtags: ["#vue"],
    });
    expect(hash1).not.toBe(hash2);
  });

  it("whitespace variations produce same hash", () => {
    const hash1 = createContentHash({
      opening: "Hello World",
      body: "Content",
      takeaway: "Key",
      nextStep: "Next",
      hashtags: [],
    });
    const hash2 = createContentHash({
      opening: "  Hello World  ",
      body: "  Content  ",
      takeaway: "  Key  ",
      nextStep: "  Next  ",
      hashtags: [],
    });
    expect(hash1).toBe(hash2);
  });

  it("case variations produce same hash", () => {
    const hash1 = createContentHash({
      opening: "HELLO",
      body: "WORLD",
      takeaway: "KEY",
      nextStep: "NEXT",
      hashtags: [],
    });
    const hash2 = createContentHash({
      opening: "hello",
      body: "world",
      takeaway: "key",
      nextStep: "next",
      hashtags: [],
    });
    expect(hash1).toBe(hash2);
  });

  it("hashtag order does not affect hash", () => {
    const hash1 = createContentHash({
      opening: "a",
      body: "b",
      takeaway: "c",
      nextStep: "d",
      hashtags: ["#zebra", "#alpha", "#middle"],
    });
    const hash2 = createContentHash({
      opening: "a",
      body: "b",
      takeaway: "c",
      nextStep: "d",
      hashtags: ["#alpha", "#middle", "#zebra"],
    });
    expect(hash1).toBe(hash2);
  });
});

// ─── 9. Status Transition Map ───────────────────────────────────────────────

describe("ALLOWED_POST_STATUS_TRANSITIONS", () => {
  it("draft allows approved and failed", () => {
    expect(ALLOWED_POST_STATUS_TRANSITIONS.draft).toContain("approved");
    expect(ALLOWED_POST_STATUS_TRANSITIONS.draft).toContain("failed");
  });

  it("approved allows published only", () => {
    expect(ALLOWED_POST_STATUS_TRANSITIONS.approved).toEqual(["published"]);
  });

  it("published allows nothing", () => {
    expect(ALLOWED_POST_STATUS_TRANSITIONS.published).toEqual([]);
  });

  it("failed allows nothing", () => {
    expect(ALLOWED_POST_STATUS_TRANSITIONS.failed).toEqual([]);
  });
});
