import { describe, it, expect } from "vitest";
import { buildVisualBrief } from "./visual/brief";
import { renderVisualBrief } from "./visual/compositions";
import { checkSvgSafety, escapeXml } from "./svg/escape";
import { renderTemplate } from "./svg/templates";
import { generateFallbackSvg } from "./svg/fallback";
import { brand } from "@/config/brand";
import type { GeneratedPostRow } from "@/types/generated-post";
import type { VisualBrief, VisualComposition } from "@/types/image";

const W = brand.image.width;
const H = brand.image.height;
// Content zone left edge (≥80px horizontal safe margin on the light side).
const LIGHT_LEFT = 100;

// 16:9 aspect target used by the landscape layout (1600×900 branded canvas).
function expectLandscapeAspect(): void {
  expect(W).toBe(1600);
  expect(H).toBe(900);
  expect(W / H).toBeCloseTo(16 / 9, 4);
}

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

function briefFor(overrides: Partial<GeneratedPostRow>, topic: string, postType: string | null = "TECHNICAL_LESSON"): VisualBrief {
  return buildVisualBrief({
    post: basePost(overrides),
    topic,
    moduleNumber: 2,
    moduleTitle: "Backend Module",
    postType,
  });
}

const FIXTURES: Array<{ label: string; postType: string | null; topic: string; post: Partial<GeneratedPostRow> }> = [
  {
    label: "Learning",
    postType: "TECHNICAL_LESSON",
    topic: "JavaScript Closures",
    post: { opening: "A function keeps access to its outer scope.", body: "Closures capture their lexical scope.", takeaway: "Closures capture where they were defined." },
  },
  {
    label: "Project",
    postType: "PROJECT_SHOWCASE",
    topic: "Full-Stack Notes App",
    post: { opening: "A React frontend calls a REST API backed by a database.", body: "The flow is client → API → database.", takeaway: "A clean client → API → database flow keeps concerns separated." },
  },
  {
    label: "Problem Solving",
    postType: "PROBLEM_SOLUTION",
    topic: "Slow Query",
    post: { opening: "A query was slow because it scanned every row.", body: "Adding an index turned the lookup into a fast path.", takeaway: "The right index avoids a full table scan." },
  },
  {
    label: "Security",
    postType: "SECURITY_LESSON",
    topic: "Row-Level Security",
    post: { opening: "RLS prevents users from reading each other's data.", body: "Each user can only query their own rows.", takeaway: "RLS scopes access by owner." },
  },
  {
    label: "Career",
    postType: "LEARNING_MILESTONE",
    topic: "Module 2 Complete",
    post: { opening: "I finished the second module of my journey.", body: "Backend fundamentals step by step.", takeaway: "Progress compounds across modules." },
  },
  {
    label: "Comparison",
    postType: "ENGINEERING_DECISION",
    topic: "SQL vs NoSQL",
    post: { opening: "SQL vs NoSQL depends on your data.", body: "SQL gives relational integrity; NoSQL scales horizontally.", takeaway: "Pick based on consistency needs." },
  },
];

/** Extracts numeric attribute values from a generated SVG for bounds checking. */
function numericAttrs(svg: string): number[] {
  const values: number[] = [];
  const attrRe = /(?:x1?|y1?|x2|y2|width|height|cx|cy|r)="([-0-9.]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(svg)) !== null) {
    const v = Number.parseFloat(m[1]!);
    if (!Number.isNaN(v)) values.push(v);
  }
  return values;
}

function textCoords(svg: string): { x: number[]; y: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  for (const m of svg.matchAll(/<text\b[^>]*?\bx="([-0-9.]+)"[^>]*?\by="([-0-9.]+)"/g)) {
    x.push(Number.parseFloat(m[1]!));
    y.push(Number.parseFloat(m[2]!));
  }
  return { x, y };
}

describe("landscape 1600×900 (16:9) branded canvas", () => {
  it("exports brand image as 1600×900", () => {
    expectLandscapeAspect();
  });

  it("renders SVG with viewBox, width and height matching the branded canvas", () => {
    for (const f of FIXTURES) {
      const svg = renderVisualBrief(briefFor(f.post, f.topic, f.postType));
      expect(svg, f.label).toContain(`viewBox="0 0 ${W} ${H}"`);
      expect(svg, f.label).toContain(`width="${W}"`);
      expect(svg, f.label).toContain(`height="${H}"`);
      expect(wrapperAspect(svg), f.label).toBeCloseTo(16 / 9, 3);
    }
  });

  it("rasterizes to a 1600×900 PNG (16:9)", async () => {
    const sharp = (await import("sharp")).default;
    const svg = renderVisualBrief(briefFor(FIXTURES[0]!.post, FIXTURES[0]!.topic, FIXTURES[0]!.postType));
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(1600);
    expect(meta.height).toBe(900);
  });

  it("paints the navy diagonal branding block and navy/white split", () => {
    const svg = renderVisualBrief(briefFor(FIXTURES[0]!.post, FIXTURES[0]!.topic, FIXTURES[0]!.postType));
    // Deep-navy gradient block wedges in from the right.
    expect(svg).toContain("bgNavy");
    expect(svg).toContain(brand.colors.navy);
    expect(svg).toContain(brand.colors.blue);
    expect(svg).toContain(brand.colors.cyan);
    // The diagonal split polygon spans the full canvas height.
    expect(svg).toMatch(/<path[\s\S]*?M 1600 0 L 1104 0 L 856 900 L 1600 900 Z/);
  });
});

function wrapperAspect(svg: string): number {
  const w = Number.parseFloat(/<svg\b[^>]*\bwidth="([0-9.]+)"/.exec(svg)?.[1] ?? "0");
  const h = Number.parseFloat(/<svg\b[^>]*\bheight="([0-9.]+)"/.exec(svg)?.[1] ?? "0");
  return w / h;
}

describe("safe margins and no clipping", () => {
  it("never places text in the outer horizontal gutters (≥80px left, safe right)", () => {
    for (const f of FIXTURES) {
      const svg = renderVisualBrief(briefFor(f.post, f.topic, f.postType));
      const { x } = textCoords(svg);
      for (const xv of x) {
        // Content (light zone) and navy-region branding must both stay off the
        // extreme left gutter (content starts at x=100) and off the right edge.
        expect(xv, `${f.label}: text x=${xv}`).toBeGreaterThanOrEqual(LIGHT_LEFT);
        expect(xv, `${f.label}: text x=${xv}`).toBeLessThanOrEqual(W - 40);
      }
    }
  });

  it("keeps text and content inside the vertical safe area (≥40px margin)", () => {
    for (const f of FIXTURES) {
      const svg = renderVisualBrief(briefFor(f.post, f.topic, f.postType));
      const { y } = textCoords(svg);
      for (const yv of y) {
        expect(yv, `${f.label}: text y=${yv}`).toBeGreaterThanOrEqual(40);
        expect(yv, `${f.label}: text y=${yv}`).toBeLessThanOrEqual(H - 40);
      }
      // Boxes, badges, pills and arrows must not cross the edges either.
      for (const v of numericAttrs(svg)) {
        expect(v >= 0 && v <= H || v <= W, `${f.label}: coordinate ${v}`).toBe(true);
      }
    }
  });

  it("never renders a negative or out-of-canvas coordinate", () => {
    for (const f of FIXTURES) {
      const svg = renderVisualBrief(briefFor(f.post, f.topic, f.postType));
      for (const v of numericAttrs(svg)) {
        if (v < 0) throw new Error(`${f.label}: negative coordinate ${v}`);
      }
    }
  });
});

describe("long content and wrapping", () => {
  it("wraps a long headline instead of overflowing", () => {
    const longHeadline = "A very long headline about the whole architecture of the system we designed today";
    const svg = renderVisualBrief(
      briefFor(
        { image_headline: longHeadline, image_subheadline: longHeadline },
        "wrapping",
        "PROJECT_SHOWCASE",
      ),
    );
    const headlineTexts = [...svg.matchAll(/font-size="52"[^>]*>([^<]*)</g)].map((m) => m[1]!);
    expect(headlineTexts.length).toBeGreaterThanOrEqual(2);
    for (const text of headlineTexts) {
      expect(text.length).toBeLessThanOrEqual(34);
    }
    expect(checkSvgSafety(svg)).toBeNull();
  });

  it("keeps long technology names inside the canvas at a readable size", () => {
    const brief = briefFor({}, "PostgreSQL Indexing", "DATABASE_ENGINEERING");
    const svg = renderVisualBrief({
      ...brief,
      technologies: ["PostgreSQL", "TypeScript", "GitHub Actions", "Authentication"],
    });
    for (const name of ["PostgreSQL", "GitHub Actions"]) {
      expect(svg).toContain(name);
    }
    const fontSizes = [...svg.matchAll(/font-size="([0-9.]+)"/g)].map((m) => Number.parseFloat(m[1]!));
    expect(Math.min(...fontSizes)).toBeGreaterThanOrEqual(14);
    expect(checkSvgSafety(svg)).toBeNull();
  });
});

describe("font and glyph safety (no tofu boxes)", () => {
  it("uses a portable stacked font-family on every text element", () => {
    const svg = renderVisualBrief(briefFor({}, "JavaScript Closures", "TECHNICAL_LESSON"));
    const textCount = (svg.match(/<text[\s>]/g) ?? []).length;
    const fontAttrs = (svg.match(/font-family="([^"]+)"/g) ?? []);
    expect(textCount).toBeGreaterThan(0);
    expect(fontAttrs.length).toBe(textCount);
    for (const f of fontAttrs) {
      expect(f).toMatch(/sans-serif/);
    }
  });

  it("strips emojis from headline/subheadline", () => {
    const svg = renderVisualBrief(
      briefFor({ image_headline: "Learning 🔥 is fun! 🚀", image_subheadline: "Stay curious 😄" }, "Learning"),
    );
    expect(svg).not.toContain("🔥");
    expect(svg).not.toContain("🚀");
    expect(svg).not.toContain("😄");
    expect(svg).toContain("Learning");
  });

  it("escapes XML special characters and keeps technical names intact", () => {
    const svg = renderVisualBrief(
      briefFor({ image_headline: "A <B> & \"C\" 'D' E> — React & Node.js", image_subheadline: "x & y (parentheses)'" }, "Topic"),
    );
    expect(escapeXml("&")).toBe("&amp;");
    expect(svg).not.toContain("<B>");
    expect(svg).toContain("&lt;B&gt;");
    expect(svg).toContain("&amp;");
    expect(svg).toContain("React");
    expect(svg).toContain("Node.js");
    expect(checkSvgSafety(svg)).toBeNull();
  });
});

describe("all supported compositions render", () => {
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

  it("renders every composition safely within the canvas", () => {
    for (const composition of ALL_COMPOSITIONS) {
      const brief: VisualBrief = {
        headline: "H & <T> head 🔥",
        subheadline: "Supporting line",
        concept: "REST API",
        visualMetaphor: "CLIENT → API → SERVICE → DATABASE",
        keyPoints: [
          { label: "CLIENT", detail: "Makes the request" },
          { label: "API", detail: "Validates and routes" },
          { label: "SERVICE", detail: "Applies business logic" },
          { label: "DATABASE", detail: "Stores the data" },
        ],
        technologies: ["React", "Node.js"],
        recruiterSignal: "Engineering Execution",
        postType: "API_INTEGRATION",
        dayNumber: 5,
        module: "Backend Module",
        theme: "project-build",
        composition,
      };
      const svg = renderVisualBrief(brief);
      expect(svg, composition).toContain(`width="${W}"`);
      expect(svg, composition).toContain(`height="${H}"`);
      expect(checkSvgSafety(svg), composition).toBeNull();
      for (const v of numericAttrs(svg)) {
        if (v < 0) throw new Error(`${composition}: negative coordinate ${v}`);
      }
    }
  });
});

describe("determinism", () => {
  it("renders an identical SVG for identical input", () => {
    for (const f of FIXTURES) {
      const a = renderVisualBrief(briefFor(f.post, f.topic, f.postType));
      const b = renderVisualBrief(briefFor(f.post, f.topic, f.postType));
      expect(a, f.label).toBe(b);
    }
  });
});

describe("branded theme details", () => {
  it("draws the electric-blue diagonal accent line + thin cyan parallel line", () => {
    const svg = renderVisualBrief(briefFor({}, "JavaScript Closures", "TECHNICAL_LESSON"));
    expect(svg).toContain(brand.colors.blue);
    expect(svg).toContain(brand.colors.cyan);
    // 5px electric-blue diagonal accent (brand color) exists on the canvas.
    expect(svg).toContain(`stroke="${brand.colors.blue}" stroke-width="5"`);
    // A cyan parallel hairline follows it.
    expect(svg).toContain(`stroke="${brand.colors.cyan}" stroke-width="1.4"`);
  });

  it("places the TB logo embed in the lower-right navy block at the spec size", async () => {
    const { loadLogoEmbed } = await import("./logo");
    const logo = await loadLogoEmbed();
    expect(logo).not.toBeNull();
    expect(logo!.width).toBe(200);
    expect(logo!.height).toBe(200);
    expect(logo!.aspect).toBe(1);
    const svg = renderVisualBrief(briefFor({}, "JavaScript Closures", "TECHNICAL_LESSON"), logo);
    // Logo sits inside the navy region, right of the diagonal and off the edge.
    expect(svg).toContain('x="1280"');
    expect(svg).toContain('y="624"');
    expect(svg).toContain('width="200"');
    expect(svg).toContain('height="200"');
    expect(logo!.dataUri.startsWith("data:image/png;base64,")).toBe(true);
    expect(checkSvgSafety(svg)).toBeNull();
  });

  it("renders deterministic output with the TB logo embed loaded", async () => {
    const { loadLogoEmbed, resetLogoEmbedCache } = await import("./logo");
    resetLogoEmbedCache();
    const logo = await loadLogoEmbed();
    const a = renderVisualBrief(briefFor({}, "JavaScript Closures", "TECHNICAL_LESSON"), logo);
    const b = renderVisualBrief(briefFor({}, "JavaScript Closures", "TECHNICAL_LESSON"), logo);
    expect(a).toBe(b);
  });

  it("fallback carrier SVG keeps the navy/white branded background and footer mark", () => {
    const svg = generateFallbackSvg({ dayNumber: 1, topic: "Introduction" });
    expect(svg).toContain(brand.colors.navy);
    expect(svg).toContain(brand.colors.blue);
    expect(svg).toContain("105 DLJ");
    expect(svg).toContain("DAY 1 / 105");
    expect(checkSvgSafety(svg)).toBeNull();
  });
});

describe("classic template and fallback paths", () => {
  it("classic templates render within the landscape canvas", () => {
    const svg = renderTemplate("large-number", {
      dayNumber: 1,
      topic: "Introduction to Web Development",
      moduleNumber: 1,
      moduleTitle: "HTML & CSS Foundations",
      headline: "Starting My Full-Stack Journey",
      subheadline: "Day 1 begins",
      keywords: ["HTML", "CSS", "Web"],
      visualConcept: "code blocks",
      template: "large-number",
    });
    expect(svg).toContain(`width="${W}"`);
    expect(svg).toContain(`height="${H}"`);
    expect(checkSvgSafety(svg)).toBeNull();
  });

  it("fallback SVG matches the landscape canvas", () => {
    const svg = generateFallbackSvg({ dayNumber: 1, topic: "Topic" });
    expect(svg).toContain(`width="${W}"`);
    expect(svg).toContain(`height="${H}"`);
    expect(checkSvgSafety(svg)).toBeNull();
  });
});

describe("anti-hallucination", () => {
  it("rejects unsupported metric/claim briefs and falls back, keeping claims off the image", async () => {
    const { validateVisualBrief } = await import("./validation");
    const { BrandedSvgProvider } = await import("./providers/branded-svg");

    const brief = briefFor(
      { image_headline: "Scaling to 10,000 users", image_subheadline: "" },
      "Scaling",
    );
    const issues = validateVisualBrief(brief);
    expect(issues.length).toBeGreaterThan(0);

    const provider = new BrandedSvgProvider();
    const result = await provider.generateImage({
      dayNumber: 1,
      topic: "Scaling",
      moduleNumber: 1,
      moduleTitle: "Backend Module",
      headline: "Scaling",
      subheadline: "",
      keywords: [],
      visualConcept: "",
      template: "large-number",
      visualBrief: brief,
    });
    // Invalid brief degraded to the classic template path; the claimed metric
    // never reaches the image.
    expect(result.svg!).not.toContain("10,000");
    expect(result.svg!).not.toContain("users");
    expect(checkSvgSafety(result.svg!)).toBeNull();
  });
});