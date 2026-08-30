import { describe, it, expect } from "vitest";
import { renderTemplate } from "./index";
import type { ImageGenerationInput } from "@/types/image";
import { brand } from "@/config/brand";

const baseInput: ImageGenerationInput = {
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

describe("renderTemplate", () => {
  it("generates valid SVG with large-number template", () => {
    const svg = renderTemplate("large-number", baseInput);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain(`width="${brand.image.width}"`);
    expect(svg).toContain(`height="${brand.image.height}"`);
  });

  it("includes the series title", () => {
    const svg = renderTemplate("large-number", baseInput);
    expect(svg).toContain("105 DAYS OF FULL-STACK DEVELOPMENT");
  });

  it("includes the day number", () => {
    const svg = renderTemplate("large-number", baseInput);
    expect(svg).toContain("DAY 1");
  });

  it("includes the topic", () => {
    const svg = renderTemplate("large-number", baseInput);
    // Long headlines wrap automatically; each wrapped fragment of the topic is
    // present in the rendered SVG.
    expect(svg).toContain("Full-Stack");
    expect(svg).toContain("Journey");
  });

  it("includes keywords", () => {
    const svg = renderTemplate("large-number", baseInput);
    expect(svg).toContain("HTML");
    expect(svg).toContain("CSS");
    expect(svg).toContain("Web");
  });

  it("includes brand mark in footer", () => {
    const svg = renderTemplate("large-number", baseInput);
    expect(svg).toContain("105 DLJ");
  });

  it("generates valid SVG with code-visual template", () => {
    const svg = renderTemplate("code-visual", { ...baseInput, template: "code-visual" });
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("DAY 1");
  });

  it("generates valid SVG with concept-diagram template", () => {
    const svg = renderTemplate("concept-diagram", { ...baseInput, template: "concept-diagram" });
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("DAY 1");
  });

  it("generates valid SVG with project-focused template", () => {
    const svg = renderTemplate("project-focused", { ...baseInput, template: "project-focused" });
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("DAY 1");
  });

  it("generates valid SVG with progress template", () => {
    const svg = renderTemplate("progress", { ...baseInput, template: "progress" });
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("DAY 1");
  });

  it("generates valid SVG with final-milestone template", () => {
    const svg = renderTemplate("final-milestone", {
      ...baseInput,
      dayNumber: 105,
      template: "final-milestone",
    });
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("105");
    expect(svg).toContain("JOURNEY COMPLETE");
  });

  it("all templates use brand colors", () => {
    const templates = [
      "large-number",
      "code-visual",
      "concept-diagram",
      "project-focused",
      "progress",
      "final-milestone",
    ] as const;

    for (const template of templates) {
      const svg = renderTemplate(template, baseInput);
      expect(svg).toContain(brand.colors.navy);
      expect(svg).toContain(brand.colors.blue);
      expect(svg).toContain(brand.colors.cyan);
    }
  });

  it("all templates include series branding", () => {
    const templates = [
      "large-number",
      "code-visual",
      "concept-diagram",
      "project-focused",
      "progress",
      "final-milestone",
    ] as const;

    for (const template of templates) {
      const svg = renderTemplate(template, baseInput);
      expect(svg).toContain("105 DAYS OF FULL-STACK DEVELOPMENT");
    }
  });
});
