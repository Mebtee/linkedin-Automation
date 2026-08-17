import { describe, it, expect } from "vitest";
import { generateFallbackSvg } from "./fallback";
import { brand } from "@/config/brand";

describe("generateFallbackSvg", () => {
  it("generates valid SVG", () => {
    const svg = generateFallbackSvg({ dayNumber: 1, topic: "Introduction" });
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain(`width="${brand.image.width}"`);
    expect(svg).toContain(`height="${brand.image.height}"`);
  });

  it("includes the series title", () => {
    const svg = generateFallbackSvg({ dayNumber: 1, topic: "Introduction" });
    expect(svg).toContain("105 DAYS OF FULL-STACK DEVELOPMENT");
  });

  it("includes the day number", () => {
    const svg = generateFallbackSvg({ dayNumber: 42, topic: "Arrays" });
    expect(svg).toContain("DAY 42");
    expect(svg).toContain("/ 105");
  });

  it("includes the topic", () => {
    const svg = generateFallbackSvg({ dayNumber: 1, topic: "Python Basics" });
    expect(svg).toContain("Python Basics");
  });

  it("includes brand mark", () => {
    const svg = generateFallbackSvg({ dayNumber: 1, topic: "Introduction" });
    expect(svg).toContain("105 DLJ");
  });

  it("uses brand colors", () => {
    const svg = generateFallbackSvg({ dayNumber: 1, topic: "Introduction" });
    expect(svg).toContain(brand.colors.navy);
    expect(svg).toContain(brand.colors.blue);
    expect(svg).toContain(brand.colors.cyan);
  });

  it("escapes special characters in topic", () => {
    const svg = generateFallbackSvg({ dayNumber: 1, topic: 'A < B & C "D"' });
    expect(svg).toContain("&lt;");
    expect(svg).toContain("&amp;");
    expect(svg).toContain("&quot;");
    expect(svg).not.toContain('A < B & C "D"');
  });

  it("always succeeds even with minimal input", () => {
    const svg = generateFallbackSvg({ dayNumber: 105, topic: "" });
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });
});
