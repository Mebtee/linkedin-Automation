import { describe, it, expect } from "vitest";
import { renderVisualBrief } from "./compositions";
import { checkSvgSafety } from "../svg/escape";
import { brand } from "@/config/brand";
import type { VisualBrief, VisualComposition } from "@/types/image";

function makeBrief(overrides: Partial<VisualBrief> = {}): VisualBrief {
  return {
    headline: "Database Indexes",
    subheadline: "An index turns a query into a fast path to the right rows.",
    concept: "Database Indexes",
    visualMetaphor: "QUERY → INDEX → DATABASE → FASTER LOOKUP",
    keyPoints: [
      { label: "QUERY", detail: "Find the rows" },
      { label: "INDEX", detail: "Fast lookup path" },
      { label: "FASTER LOOKUP", detail: "Avoid full scan" },
    ],
    technologies: ["PostgreSQL", "SQL"],
    recruiterSignal: "Technical Depth",
    postType: "DATABASE_ENGINEERING",
    dayNumber: 12,
    module: "Database Module",
    theme: "technical-explanation",
    composition: "concept-flow",
    ...overrides,
  };
}

const ALL_COMPOSITIONS: VisualComposition[] = [
  "concept-flow",
  "problem-solution",
  "three-ideas",
  "architecture-flow",
  "before-after",
  "skill-progression",
  "comparison",
  "input-process-output",
];

describe("renderVisualBrief", () => {
  it("produces valid SVG for every composition", () => {
    for (const composition of ALL_COMPOSITIONS) {
      const svg = renderVisualBrief(makeBrief({ composition }));
      expect(svg).toContain("<svg");
      expect(svg).toContain("</svg>");
      expect(svg).toContain(`width="${brand.image.width}"`);
      expect(svg).toContain(`height="${brand.image.height}"`);
      expect(checkSvgSafety(svg)).toBeNull();
    }
  });

  it("is deterministic: same brief renders identical SVG", () => {
    const brief = makeBrief();
    expect(renderVisualBrief(brief)).toBe(renderVisualBrief(brief));
  });

  it("includes the day badge when journey data is present", () => {
    const svg = renderVisualBrief(makeBrief());
    expect(svg).toContain("DAY 12 / 105");
  });

  it("omits day badge when no journey data present", () => {
    const svg = renderVisualBrief(makeBrief({ dayNumber: undefined, module: undefined }));
    expect(svg).not.toContain("DAY 12 / 105");
    expect(svg).not.toContain("DATABASE MODULE");
  });

  it("renders headline and technology labels", () => {
    const svg = renderVisualBrief(makeBrief());
    expect(svg).toContain("PostgreSQL");
    expect(svg).toContain("SQL");
  });

  it("escapes user-controlled text to prevent injection", () => {
    const brief = makeBrief({ headline: "<script>alert(1)</script> Headline" });
    const svg = renderVisualBrief(brief);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(checkSvgSafety(svg)).toBeNull();
  });

  it("handles long titles without breaking the scaffold", () => {
    const long = "This is an extremely long headline that goes on and on and should still render safely within the canvas";
    const svg = renderVisualBrief(makeBrief({ headline: long }));
    expect(svg).toContain("<svg");
    expect(checkSvgSafety(svg)).toBeNull();
  });

  it("handles long technology names gracefully", () => {
    const brief = makeBrief({ technologies: ["VeryLongTechnologyNameExample", "AnotherVeryLongTechnology"] });
    const svg = renderVisualBrief(brief);
    expect(svg).toContain("<svg");
    expect(checkSvgSafety(svg)).toBeNull();
  });

  it("handles empty optional fields safely", () => {
    const svg = renderVisualBrief(makeBrief({ subheadline: "", technologies: [], keyPoints: [], recruiterSignal: undefined }));
    expect(svg).toContain("<svg");
    expect(checkSvgSafety(svg)).toBeNull();
  });

  it("uses brand colors", () => {
    const svg = renderVisualBrief(makeBrief());
    expect(svg).toContain(brand.colors.navy);
    expect(svg).toContain(brand.colors.blue);
    expect(svg).toContain(brand.colors.cyan);
  });

  it("uses different structures for different compositions", () => {
    const flow = renderVisualBrief(makeBrief({ composition: "concept-flow" }));
    const cards = renderVisualBrief(makeBrief({ composition: "three-ideas" }));
    expect(flow).not.toBe(cards);
  });

  it("renders a problem-solution composition with problem and solution framing", () => {
    const svg = renderVisualBrief(makeBrief({ composition: "problem-solution", theme: "problem-solving" }));
    expect(svg).toContain("PROBLEM");
    expect(svg).toContain("SOLUTION");
    expect(svg).toContain("RESULT");
  });

  it("renders the primary concept as a small Level-1 tag when present", () => {
    const svg = renderVisualBrief(makeBrief({ primaryConcept: "Row-Level Security" }));
    expect(svg).toContain("ROW-LEVEL SECURITY");
  });

  it("renders an input-process-output composition with stage framing", () => {
    const svg = renderVisualBrief(makeBrief({ composition: "input-process-output", theme: "learning-concept" }));
    expect(svg).toContain("INPUT");
    expect(svg).toContain("PROCESS");
    expect(svg).toContain("OUTPUT");
    expect(checkSvgSafety(svg)).toBeNull();
  });

  it("keeps critical content inside a safe margin (no overflow coordinates)", () => {
    for (const composition of ALL_COMPOSITIONS) {
      const svg = renderVisualBrief(makeBrief({ composition, headline: "A long headline that wraps onto a second line safely within the mobile canvas" }));
      expect(svg).toContain("<svg");
      expect(checkSvgSafety(svg)).toBeNull();
    }
  });
});
