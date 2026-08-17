import { describe, it, expect } from "vitest";
import { AppError } from "@/lib/utils/errors";
import {
  validateDayNumber,
  validateJournalInput,
  validateSubmission,
  validateStatusTransition,
} from "./validation";

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

describe("validateJournalInput", () => {
  it("passes through valid text fields", () => {
    const result = validateJournalInput({
      what_i_learned: "React hooks",
    });
    expect(result.what_i_learned).toBe("React hooks");
  });

  it("trims whitespace from text fields", () => {
    const result = validateJournalInput({
      what_i_learned: "  React hooks  ",
    });
    expect(result.what_i_learned).toBe("React hooks");
  });

  it("converts empty strings to null", () => {
    const result = validateJournalInput({
      what_i_learned: "   ",
    });
    expect(result.what_i_learned).toBeNull();
  });

  it("converts undefined to null", () => {
    const result = validateJournalInput({
      what_i_learned: undefined,
    });
    expect(result.what_i_learned).toBeNull();
  });

  it("validates confidence_level 1–5", () => {
    expect(validateJournalInput({ confidence_level: 1 }).confidence_level).toBe(1);
    expect(validateJournalInput({ confidence_level: 5 }).confidence_level).toBe(5);
    expect(validateJournalInput({ confidence_level: null }).confidence_level).toBeNull();
  });

  it("rejects confidence_level outside 1–5", () => {
    expect(() => validateJournalInput({ confidence_level: 0 })).toThrow(AppError);
    expect(() => validateJournalInput({ confidence_level: 6 })).toThrow(AppError);
  });

  it("rejects text exceeding max length", () => {
    const longText = "a".repeat(5001);
    expect(() =>
      validateJournalInput({ what_i_learned: longText }),
    ).toThrow(AppError);
  });

  it("accepts text at max length", () => {
    const maxText = "a".repeat(5000);
    const result = validateJournalInput({ what_i_learned: maxText });
    expect(result.what_i_learned).toBe(maxText);
  });

  it("ignores unknown fields", () => {
    const result = validateJournalInput({
      what_i_learned: "test",
      unknown_field: "should be ignored",
    });
    expect(result.what_i_learned).toBe("test");
    expect(result).not.toHaveProperty("unknown_field");
  });
});

describe("validateSubmission", () => {
  it("passes when what_i_learned is provided", () => {
    expect(() =>
      validateSubmission({
        what_i_learned: "React hooks",
        what_i_practiced: null,
        what_i_built: null,
        key_takeaway: null,
      }),
    ).not.toThrow();
  });

  it("passes when what_i_practiced is provided", () => {
    expect(() =>
      validateSubmission({
        what_i_learned: null,
        what_i_practiced: "Built a todo app",
        what_i_built: null,
        key_takeaway: null,
      }),
    ).not.toThrow();
  });

  it("passes when what_i_built is provided", () => {
    expect(() =>
      validateSubmission({
        what_i_learned: null,
        what_i_practiced: null,
        what_i_built: "Portfolio site",
        key_takeaway: null,
      }),
    ).not.toThrow();
  });

  it("passes when key_takeaway is provided", () => {
    expect(() =>
      validateSubmission({
        what_i_learned: null,
        what_i_practiced: null,
        what_i_built: null,
        key_takeaway: "Consistency matters",
      }),
    ).not.toThrow();
  });

  it("rejects when all core fields are null", () => {
    expect(() =>
      validateSubmission({
        what_i_learned: null,
        what_i_practiced: null,
        what_i_built: null,
        key_takeaway: null,
      }),
    ).toThrow(AppError);
  });

  it("throws VALIDATION_ERROR code", () => {
    try {
      validateSubmission({
        what_i_learned: null,
        what_i_practiced: null,
        what_i_built: null,
        key_takeaway: null,
      });
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("validateStatusTransition", () => {
  it("allows draft → submitted", () => {
    expect(() => validateStatusTransition("draft", "submitted")).not.toThrow();
  });

  it("allows submitted → draft (reopen)", () => {
    expect(() => validateStatusTransition("submitted", "draft")).not.toThrow();
  });

  it("rejects draft → used", () => {
    expect(() => validateStatusTransition("draft", "used")).toThrow(AppError);
  });

  it("rejects submitted → used", () => {
    expect(() => validateStatusTransition("submitted", "used")).toThrow(AppError);
  });

  it("rejects used → any", () => {
    expect(() => validateStatusTransition("used", "draft")).toThrow(AppError);
    expect(() => validateStatusTransition("used", "submitted")).toThrow(AppError);
  });

  it("throws INVALID_STATUS code", () => {
    try {
      validateStatusTransition("draft", "used");
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("INVALID_STATUS");
    }
  });
});
