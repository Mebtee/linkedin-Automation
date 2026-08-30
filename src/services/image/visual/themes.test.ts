import { describe, it, expect } from "vitest";
import { selectTheme, selectComposition, clampKeyPoints, truncate } from "./themes";
import type { VisualTheme } from "@/types/image";

describe("selectTheme", () => {
  const base = { format: "concept", text: "learning about x", topic: "x" };

  it("is deterministic", () => {
    expect(selectTheme(base)).toBe(selectTheme(base));
  });

  it("maps security post type to security theme", () => {
    expect(selectTheme({ ...base, postType: "SECURITY_LESSON" })).toBe("security");
  });

  it("maps problem post type to problem-solving theme", () => {
    expect(selectTheme({ ...base, postType: "PROBLEM_SOLUTION" })).toBe("problem-solving");
  });

  it("maps project post type to project-build theme", () => {
    expect(selectTheme({ ...base, postType: "PROJECT_SHOWCASE" })).toBe("project-build");
  });

  it("maps career post type to career-growth theme", () => {
    expect(selectTheme({ ...base, postType: "CAREER_PROGRESS" })).toBe("career-growth");
  });

  it("detects security from keyword text", () => {
    expect(selectTheme({ ...base, postType: null, text: "authentication and authorization" })).toBe("security");
  });

  it("detects problem-solving from keyword text", () => {
    expect(selectTheme({ ...base, postType: null, text: "I fixed a bug in the login flow" })).toBe("problem-solving");
  });

  it("defaults to learning-concept without explicit signals", () => {
    expect(selectTheme({ ...base, postType: null, text: "general notes" })).toBe("learning-concept");
  });
});

describe("selectComposition", () => {
  it("is deterministic", () => {
    const input = { theme: "learning-concept" as VisualTheme, text: "a b c", keyPointCount: 3, postType: null };
    expect(selectComposition(input)).toBe(selectComposition(input));
  });

  it("uses problem-solution for debugging", () => {
    expect(selectComposition({ theme: "problem-solving", text: "bug", keyPointCount: 3, postType: "DEBUGGING_STORY" })).toBe("problem-solution");
  });

  it("uses architecture-flow for projects", () => {
    expect(selectComposition({ theme: "project-build", text: "build", keyPointCount: 2, postType: "PROJECT_SHOWCASE" })).toBe("architecture-flow");
  });

  it("uses before-after for security", () => {
    expect(selectComposition({ theme: "security", text: "auth", keyPointCount: 2, postType: "SECURITY_LESSON" })).toBe("before-after");
  });

  it("uses skill-progression for career growth", () => {
    expect(selectComposition({ theme: "career-growth", text: "growth", keyPointCount: 2, postType: "CAREER_PROGRESS" })).toBe("skill-progression");
  });

  it("learn picks three-ideas when >=3 key points", () => {
    expect(selectComposition({ theme: "learning-concept", text: "learn", keyPointCount: 3, postType: null })).toBe("three-ideas");
  });

  it("learn picks concept-flow when <3 key points", () => {
    expect(selectComposition({ theme: "learning-concept", text: "learn", keyPointCount: 2, postType: null })).toBe("concept-flow");
  });
});

describe("clampKeyPoints", () => {
  it("truncates long labels and details", () => {
    const points = [{ label: "a very long label that should be truncated for layout", detail: "another extremely long detail string that would overflow the card boundary" }];
    const result = clampKeyPoints(points, 1);
    expect(result.length).toBe(1);
    const first = result[0]!;
    expect(first.label.length).toBeLessThanOrEqual(26);
    expect(first.detail.length).toBeLessThanOrEqual(44);
  });

  it("drops empty labels", () => {
    expect(clampKeyPoints([{ label: "", detail: "x" }], 4)).toHaveLength(0);
  });

  it("limits the count", () => {
    const points = [1, 2, 3, 4, 5].map((n) => ({ label: `p${n}`, detail: "" }));
    expect(clampKeyPoints(points, 3)).toHaveLength(3);
  });
});

describe("truncate", () => {
  it("leaves short strings intact", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates long strings", () => {
    expect(truncate("abcdefghij", 5)).toBe("abcd…");
  });

  it("handles empty string", () => {
    expect(truncate("", 5)).toBe("");
  });
});
