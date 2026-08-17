import { describe, it, expect } from "vitest";
import { validateImageInput, validateImageOutput, ImageValidationError } from "./validation";
import type { ImageGenerationInput } from "@/types/image";

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
