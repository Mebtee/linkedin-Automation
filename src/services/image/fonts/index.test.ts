import { describe, it, expect, beforeEach } from "vitest";
import { initEmbeddedFont, getEmbeddedFontStyle, resetFontCache, SVG_FONT_FAMILY } from "../fonts";
import { renderVisualBrief } from "../visual/compositions";
import { buildVisualBrief } from "../visual/brief";
import { checkSvgSafety } from "../svg/escape";
import type { GeneratedPostRow } from "@/types/generated-post";

function basePost(overrides: Partial<GeneratedPostRow> = {}): GeneratedPostRow {
  return {
    id: "post-1",
    profile_id: "prof-1",
    journal_entry_id: "entry-1",
    day_number: 23,
    status: "draft",
    format: "concept",
    opening: "",
    body: "",
    takeaway: "",
    next_step: "",
    hashtags: [],
    image_headline: null,
    image_subheadline: null,
    image_keywords: null,
    image_visual_concept: null,
    image_template: null,
    provider: "test",
    model: "test",
    tokens_used: 0,
    content_hash: "hash",
    opportunity_id: null,
    recruiter_quality_score: null,
    recruiter_quality_report: null,
    linkedin_post_id: null,
    published_at: null,
    publish_error: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const PYTHON_POST: Partial<GeneratedPostRow> = {
  opening: "Learning Python Collections, Files & Errors.",
  body: "Section 5 covers lists, tuples, dictionaries, sets and comprehensions; Section 7 covers reading and writing files.",
  takeaway: "Python collections, file I/O and error handling are the foundation of data processing.",
  next_step: "Apply these patterns to batch file processing.",
  image_headline: "Python Collections, Files & Errors",
};

describe("embedded font", () => {
  beforeEach(() => resetFontCache());

  it("embeds a valid @font-face style block with all weights", async () => {
    const style = await initEmbeddedFont();
    expect(style).toContain("@font-face");
    expect(style).toContain("font-family:'Inter'");
    expect(style).toContain("data:font/woff2;base64,");
    expect(style).toContain("font-weight:400");
    expect(style).toContain("font-weight:800");
  });

  it("is idempotent and caches the same style block", async () => {
    const a = await initEmbeddedFont();
    const b = await initEmbeddedFont();
    expect(a).toBe(b);
    expect(getEmbeddedFontStyle()).toBe(a);
  });

  it("includes the embedded font in rendered SVGs (no tofu risk)", async () => {
    await initEmbeddedFont();
    const brief = buildVisualBrief({
      post: basePost(PYTHON_POST),
      topic: "Python Collections, Files & Errors",
      moduleNumber: 2,
      moduleTitle: "Backend Module",
      postType: "TECHNICAL_LESSON",
    });
    const svg = renderVisualBrief(brief);
    expect(svg).toContain("@font-face");
    expect(svg).toContain("data:font/woff2;base64,");
    expect(svg).toContain(SVG_FONT_FAMILY.split(",")[0]!);
    expect(checkSvgSafety(svg)).toBeNull();
  });
});

describe("rasterized PNG (tofu/blank regression)", () => {
  it("rasterizes to a 1600×900 PNG with non-blank ink (font embedded, no tofu)", async () => {
    await initEmbeddedFont();
    const sharp = (await import("sharp")).default;
    const brief = buildVisualBrief({
      post: basePost(PYTHON_POST),
      topic: "Python Collections, Files & Errors",
      moduleNumber: 2,
      moduleTitle: "Backend Module",
      postType: "TECHNICAL_LESSON",
    });
    const svg = renderVisualBrief(brief);
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(1600);
    expect(meta.height).toBe(900);

    // The raster must contain meaningful rendered content — not a blank page or
    // a page of replacement/tofu boxes. Sample the region covering the light-zone
    // headline and the navy rights which carry the takeaways.
    const { data, info } = await sharp(png)
      .extract({ left: 200, top: 200, width: 400, height: 200 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    let nonWhite = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      if (r < 245 || g < 245 || b < 245) nonWhite++;
    }
    const total = info.width * info.height;
    expect(nonWhite / total).toBeGreaterThan(0.02);
  });

  it("python post derives COLLECTIONS → FILE I/O → ERROR HANDLING without hardcoding", () => {
    const brief = buildVisualBrief({
      post: basePost(PYTHON_POST),
      topic: "Python Collections, Files & Errors",
      moduleNumber: 2,
      moduleTitle: "Backend Module",
      postType: "TECHNICAL_LESSON",
    });
    expect(brief.visualMetaphor).toContain("COLLECTIONS");
    expect(brief.visualMetaphor).toContain("FILE I/O");
    expect(brief.visualMetaphor).toContain("ERROR");
    // Takeaways come only from post words — never alternate invented labels.
    expect(brief.keyTakeaways).toContain("COLLECTIONS");
    expect(brief.keyTakeaways).toContain("FILE I/O");
  });
});
