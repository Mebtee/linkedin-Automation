import { describe, it, expect } from "vitest";
import { BrandedSvgProvider } from "./branded-svg";
import type { ImageGenerationInput } from "@/types/image";
import { brand } from "@/config/brand";
import { checkSvgSafety } from "../svg/escape";

const validInput: ImageGenerationInput = {
  dayNumber: 1,
  topic: "Introduction to Web Development",
  moduleNumber: 1,
  moduleTitle: "HTML & CSS Foundations",
  headline: "Starting My Full-Stack Journey",
  subheadline: "Day 1 begins",
  keywords: ["HTML", "CSS", "Web"],
  visualConcept: "code blocks",
  template: "large-number",
};

describe("BrandedSvgProvider", () => {
  it("implements ImageGenerationProvider interface", () => {
    const provider = new BrandedSvgProvider();
    expect(typeof provider.generateImage).toBe("function");
  });

  it("generates SVG with correct dimensions", async () => {
    const provider = new BrandedSvgProvider();
    const result = await provider.generateImage(validInput);
    expect(result.width).toBe(brand.image.width);
    expect(result.height).toBe(brand.image.height);
  });

  it("generates SVG containing the series title", async () => {
    const provider = new BrandedSvgProvider();
    const result = await provider.generateImage(validInput);
    expect(result.svg).toContain("105 DAYS OF FULL-STACK DEVELOPMENT");
  });

  it("generates SVG containing the day number", async () => {
    const provider = new BrandedSvgProvider();
    const result = await provider.generateImage(validInput);
    expect(result.svg).toContain("DAY 1");
  });

  it("generates safe SVG (no script tags)", async () => {
    const provider = new BrandedSvgProvider();
    const result = await provider.generateImage(validInput);
    expect(result.svg).not.toContain("<script");
  });

  it("uses fallback when template fails", async () => {
    const provider = new BrandedSvgProvider();
    const badInput = { ...validInput, template: "invalid" as never };
    const result = await provider.generateImage(badInput);
    // Should fallback to branded SVG
    expect(result.svg).toContain("<svg");
    expect(result.svg).toContain("105 DAYS OF FULL-STACK DEVELOPMENT");
  });

  it("returns the requested template", async () => {
    const provider = new BrandedSvgProvider();
    const result = await provider.generateImage(validInput);
    expect(result.template).toBe("large-number");
  });

  it("prefers the content composition when a visualBrief is present", async () => {
    const provider = new BrandedSvgProvider();
    const withBrief: ImageGenerationInput = {
      ...validInput,
      visualBrief: {
        headline: "Git Workflow",
        subheadline: "Version your work as commits across branches.",
        concept: "Git Workflow",
        visualMetaphor: "CODE → COMMIT → BRANCH → MERGE",
        keyPoints: [
          { label: "COMMIT", detail: "Save a snapshot" },
          { label: "BRANCH", detail: "Isolate work" },
          { label: "MERGE", detail: "Combine changes" },
        ],
        technologies: ["Git"],
        recruiterSignal: "Engineering Execution",
        postType: "PROJECT_SHOWCASE",
        dayNumber: 5,
        module: "Git Module",
        theme: "project-build",
        composition: "concept-flow",
      },
    };
    const result = await provider.generateImage(withBrief);
    // Composition path renders the concept content, not the classic day-number
    // template (which would not contain the concept nodes).
    expect(result.svg).toContain("Git Workflow");
    expect(result.svg).toContain("BRANCH");
    expect(result.svg).toContain("MERGE");
  });

  it("falls back to the classic template when the visual brief is invalid", async () => {
    const provider = new BrandedSvgProvider();
    const invalidBrief: ImageGenerationInput = {
      ...validInput,
      visualBrief: {
        headline: "Scaling to 10,000 users",
        subheadline: "",
        concept: "x",
        visualMetaphor: "A → B",
        keyPoints: [],
        technologies: [],
        theme: "project-build",
        composition: "concept-flow",
      },
    };
    const result = await provider.generateImage(invalidBrief);
    // The invalid brief is rejected (unsupported metric) → classic template.
    expect(result.svg!).toContain("105 DAYS OF FULL-STACK DEVELOPMENT");
    expect(result.svg!).not.toContain("10,000");
    expect(checkSvgSafety(result.svg!)).toBeNull();
  });
});
