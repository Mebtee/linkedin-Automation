import { describe, it, expect } from "vitest";
import { BrandedSvgProvider } from "./branded-svg";
import type { ImageGenerationInput } from "@/types/image";
import { brand } from "@/config/brand";

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
});
