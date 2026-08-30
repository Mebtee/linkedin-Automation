import { describe, it, expect } from "vitest";
import { validateImageInput, validateImageOutput, validateVisualBrief, ImageValidationError } from "./validation";
import type { ImageGenerationInput, VisualBrief } from "@/types/image";

const validBrief: VisualBrief = {
  headline: "Database Indexes",
  subheadline: "An index turns a query into a fast path.",
  concept: "Database Indexes",
  visualMetaphor: "QUERY → INDEX → FASTER LOOKUP",
  keyPoints: [
    { label: "QUERY", detail: "Find the rows" },
    { label: "INDEX", detail: "Fast lookup path" },
  ],
  technologies: ["PostgreSQL", "SQL"],
  recruiterSignal: "Technical Depth",
  postType: "DATABASE_ENGINEERING",
  dayNumber: 12,
  module: "Database Module",
  theme: "technical-explanation",
  composition: "concept-flow",
  primaryConcept: "Database Indexes",
  secondaryConcepts: ["Database"],
  optionalContext: [],
  emphasis: "concept-explanation",
  postFormat: "concept",
};

const validInput: ImageGenerationInput = {
  dayNumber: 1,
  topic: "Introduction",
  moduleNumber: 1,
  moduleTitle: "Module 1",
  headline: "My Headline",
  subheadline: "My Subheadline",
  keywords: ["HTML", "CSS"],
  visualConcept: "code blocks",
  template: "large-number",
};

describe("validateImageInput", () => {
  it("accepts valid input", () => {
    const result = validateImageInput(validInput);
    expect(result.dayNumber).toBe(1);
    expect(result.topic).toBe("Introduction");
  });

  it("rejects null input", () => {
    expect(() => validateImageInput(null)).toThrow(ImageValidationError);
  });

  it("rejects non-object input", () => {
    expect(() => validateImageInput("string")).toThrow(ImageValidationError);
  });

  it("rejects missing dayNumber", () => {
    const input = { ...validInput, dayNumber: undefined };
    expect(() => validateImageInput(input)).toThrow(ImageValidationError);
  });

  it("rejects invalid dayNumber", () => {
    const input = { ...validInput, dayNumber: -1 };
    expect(() => validateImageInput(input)).toThrow(ImageValidationError);
  });

  it("rejects empty topic", () => {
    const input = { ...validInput, topic: "" };
    expect(() => validateImageInput(input)).toThrow(ImageValidationError);
  });

  it("rejects missing moduleNumber", () => {
    const input = { ...validInput, moduleNumber: undefined };
    expect(() => validateImageInput(input)).toThrow(ImageValidationError);
  });

  it("rejects empty headline", () => {
    const input = { ...validInput, headline: "" };
    expect(() => validateImageInput(input)).toThrow(ImageValidationError);
  });

  it("rejects non-array keywords", () => {
    const input = { ...validInput, keywords: "not-array" };
    expect(() => validateImageInput(input)).toThrow(ImageValidationError);
  });

  it("rejects empty template", () => {
    const input = { ...validInput, template: "" };
    expect(() => validateImageInput(input)).toThrow(ImageValidationError);
  });
});

describe("validateImageOutput", () => {
  it("accepts valid output", () => {
    const output = { svg: "<svg></svg>", width: 1200, height: 1200 };
    const result = validateImageOutput(output);
    expect(result.svg).toBe("<svg></svg>");
    expect(result.width).toBe(1200);
    expect(result.height).toBe(1200);
  });

  it("rejects null output", () => {
    expect(() => validateImageOutput(null)).toThrow(ImageValidationError);
  });

  it("rejects missing svg", () => {
    expect(() => validateImageOutput({ width: 1200, height: 1200 })).toThrow(ImageValidationError);
  });

  it("rejects empty svg", () => {
    expect(() => validateImageOutput({ svg: "", width: 1200, height: 1200 })).toThrow(ImageValidationError);
  });

  it("rejects svg without svg element", () => {
    expect(() => validateImageOutput({ svg: "<div>not svg</div>", width: 1200, height: 1200 })).toThrow(ImageValidationError);
  });

  it("rejects invalid width", () => {
    expect(() => validateImageOutput({ svg: "<svg></svg>", width: -1, height: 1200 })).toThrow(ImageValidationError);
  });

  it("rejects invalid height", () => {
    expect(() => validateImageOutput({ svg: "<svg></svg>", width: 1200, height: 0 })).toThrow(ImageValidationError);
  });
});

describe("validateVisualBrief", () => {
  it("returns no issues for a valid brief", () => {
    expect(validateVisualBrief(validBrief)).toEqual([]);
  });

  it("flags an empty headline", () => {
    const issues = validateVisualBrief({ ...validBrief, headline: "" });
    expect(issues.some((i) => i.includes("headline is empty"))).toBe(true);
  });

  it("flags an overlong headline", () => {
    const issues = validateVisualBrief({ ...validBrief, headline: "x".repeat(61) });
    expect(issues.some((i) => i.includes("exceeds 60 chars"))).toBe(true);
  });

  it("flags an overlong key point label", () => {
    const issues = validateVisualBrief({ ...validBrief, keyPoints: [{ label: "x".repeat(31), detail: "" }] });
    expect(issues.some((i) => i.includes("key point label exceeds"))).toBe(true);
  });

  it("flags an overlong metaphor node", () => {
    const issues = validateVisualBrief({ ...validBrief, visualMetaphor: "A VERY LONG NODE NAME HERE".repeat(3) });
    expect(issues.some((i) => i.includes("metaphor node exceeds"))).toBe(true);
  });

  it("flags an unknown emphasis", () => {
    const issues = validateVisualBrief({ ...validBrief, emphasis: "bogus" as never });
    expect(issues.some((i) => i.includes("unknown emphasis"))).toBe(true);
  });

  it("flags a fabricated metric as an unsupported claim", () => {
    const issues = validateVisualBrief({ ...validBrief, headline: "Scaling to 10,000 users" });
    expect(issues.some((i) => i.includes("unsupported claim"))).toBe(true);
  });
});
