import { describe, it, expect } from "vitest";
import { buildVisualBrief } from "./visual/brief";
import { renderVisualBrief } from "./visual/compositions";
import { checkSvgSafety } from "./svg/escape";
import { validateVisualBrief } from "./validation";
import type { GeneratedPostRow } from "@/types/generated-post";

function makePost(overrides: Partial<GeneratedPostRow> = {}): GeneratedPostRow {
  return {
    id: "post-1",
    profile_id: "prof-1",
    journal_entry_id: "entry-1",
    day_number: 12,
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

const ctx = (post: GeneratedPostRow, postType?: string | null, topic = "Database Indexes") => ({
  post,
  topic,
  moduleNumber: 2,
  moduleTitle: "Database Module",
  postType,
});

describe("anti-hallucination", () => {
  it("keeps course-only material in learning framing (never 'I built' or achievements)", () => {
    const post = makePost({
      format: "concept",
      opening: "In this course module students will learn about RLS.",
      body: "Students will build policies to protect rows.",
      takeaway: "RLS limits access to a user's own rows.",
    });
    const brief = buildVisualBrief(ctx(post, "TECHNICAL_LESSON"));
    const joined = [brief.headline, brief.subheadline, brief.visualMetaphor, ...brief.keyPoints.map((k) => `${k.label} ${k.detail}`)].join(" ").toLowerCase();
    expect(joined).not.toContain("i built");
    expect(joined).not.toContain("production");
    expect(brief.emphasis).toBe("concept-explanation");
  });

  it("does not turn instructor content into a personal achievement", () => {
    const post = makePost({
      opening: "The course shows how to design an API.",
      body: "Students will design a REST API for a storefront.",
      takeaway: "A clean API contract keeps the client and service decoupled.",
    });
    const brief = buildVisualBrief(ctx(post, "TECHNICAL_LESSON"));
    const joined = [brief.headline, brief.subheadline, ...brief.keyPoints.map((k) => k.label)].join(" ").toLowerCase();
    expect(joined).not.toContain("i designed");
  });

  it("never emits unsupported metrics into the rendered SVG", () => {
    const post = makePost({
      opening: "Implemented RLS in production.",
      body: "This now scales to 10,000 users safely.",
      takeaway: "RLS keeps data isolated.",
    });
    const brief = buildVisualBrief(ctx(post, "SECURITY_LESSON"));
    const svg = renderVisualBrief(brief);
    // A fabricated metric should never appear on the image.
    expect(svg).not.toContain("10,000");
    expect(svg).not.toContain("users");
    expect(svg).not.toContain("production");
    expect(checkSvgSafety(svg)).toBeNull();
  });

  it("does not invent technologies absent from the post", () => {
    const post = makePost({
      opening: "Today I thought about data isolation generally.",
      body: "No specific tools were used in this reflection.",
      takeaway: "Isolation keeps systems safe.",
    });
    const brief = buildVisualBrief(ctx(post, "TECHNICAL_LESSON"));
    expect(brief.technologies).toEqual([]);
  });

  it("validateVisualBrief returns a clean result for a valid brief", () => {
    const brief = buildVisualBrief(
      ctx(makePost({ takeaway: "An index avoids a full scan." }), "DATABASE_ENGINEERING"),
    );
    expect(validateVisualBrief(brief)).toEqual([]);
  });

  it("validateVisualBrief flags a fabricated metric", () => {
    const brief = {
      headline: "Scaling to 10,000 users",
      subheadline: "",
      concept: "x",
      visualMetaphor: "A → B",
      keyPoints: [],
      technologies: [],
      theme: "project-build" as const,
      composition: "concept-flow" as const,
    };
    const issues = validateVisualBrief(brief);
    expect(issues.some((i) => i.includes("unsupported claim"))).toBe(true);
  });

  it("validateVisualBrief flags mobile-unsafe overlong labels", () => {
    const brief = {
      headline: "ok",
      subheadline: "",
      concept: "x",
      visualMetaphor: "AN EXTREMELY LONG METAPHOR NODE THAT OVERFLOWS THE SAFE AREA",
      keyPoints: [],
      technologies: [],
      theme: "learning-concept" as const,
      composition: "concept-flow" as const,
    };
    const issues = validateVisualBrief(brief);
    expect(issues.some((i) => i.includes("metaphor node exceeds"))).toBe(true);
  });
});
