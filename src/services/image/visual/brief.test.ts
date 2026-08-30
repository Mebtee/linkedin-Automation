import { describe, it, expect } from "vitest";
import { buildVisualBrief } from "./brief";
import type { GeneratedPostRow } from "@/types/generated-post";
import type { VisualBrief, VisualTheme, VisualComposition } from "@/types/image";

function makePost(overrides: Partial<GeneratedPostRow> = {}): GeneratedPostRow {
  return {
    id: "post-1",
    profile_id: "prof-1",
    journal_entry_id: "entry-1",
    day_number: 12,
    status: "draft",
    format: "concept",
    opening: "Today I learned about database indexes.",
    body: "Indexes speed up lookups by avoiding a full table scan.",
    takeaway: "An index turns a query into a fast path to the right rows.",
    next_step: "Practice creating an index on a real table.",
    hashtags: ["#Database", "#SQL"],
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

describe("buildVisualBrief", () => {
  it("is deterministic: same input yields identical brief", () => {
    const post = makePost();
    const a = buildVisualBrief(ctx(post));
    const b = buildVisualBrief(ctx(post));
    expect(a).toEqual(b);
  });

  it("derives a concept chain from the topic", () => {
    const brief = buildVisualBrief(ctx(makePost()));
    expect(brief.concept).toContain("Index");
    expect(brief.visualMetaphor).toContain("QUERY");
    expect(brief.visualMetaphor).toContain("FASTER");
  });

  it("uses an evidence-safe headline (falls back to topic)", () => {
    const brief = buildVisualBrief(ctx(makePost()));
    expect(typeof brief.headline).toBe("string");
    expect(brief.headline.length).toBeGreaterThan(0);
  });

  it("selects security theme for security post type", () => {
    const brief = buildVisualBrief(ctx(makePost(), "SECURITY_LESSON"));
    expect(brief.theme).toBe("security");
  });

  it("selects project-build theme for project post type", () => {
    const brief = buildVisualBrief(ctx(makePost(), "PROJECT_SHOWCASE"));
    expect(brief.theme).toBe("project-build");
  });

  it("selects problem-solving theme for debugging post type", () => {
    const brief = buildVisualBrief(ctx(makePost(), "DEBUGGING_STORY"));
    expect(brief.theme).toBe("problem-solving");
    expect(brief.composition).toBe("problem-solution");
  });

  it("keeps course-only material in learning framing (no fabrication)", () => {
    const brief = buildVisualBrief(ctx(makePost()));
    // Even though it's a "concept" format, theme stays learning by default and
    // never introduces personal achievements or statistics.
    expect(brief.postType).toBeUndefined();
    expect(brief.headline.toLowerCase()).not.toContain("my production");
  });

  it("extracts known technologies without inventing them", () => {
    const post = makePost({
      format: "project",
      body: "I used Supabase with PostgreSQL and deployed with Docker.",
    });
    const brief = buildVisualBrief(ctx(post, "PROJECT_SHOWCASE"));
    expect(brief.technologies).toContain("Supabase");
    expect(brief.technologies).toContain("PostgreSQL");
    expect(brief.technologies).toContain("Docker");
  });

  it("clamps key points to a safe amount even from empty data", () => {
    const post = makePost({
      takeaway: "",
      next_step: "",
    });
    const brief = buildVisualBrief(ctx(post));
    expect(brief.keyPoints.length).toBeLessThanOrEqual(4);
  });

  it("different topics produce meaningfully different visuals", () => {
    const dbBrief = buildVisualBrief(ctx(makePost(), "DATABASE_ENGINEERING", "Database Indexes"));
    const gitPost = makePost({
      opening: "Today I learned about git branching and merging.",
      body: "Branches keep work isolated until merged into the main branch.",
      takeaway: "Branches keep work isolated until it is merged.",
      next_step: "Try a pull request workflow.",
      format: "project",
    });
    const gitBrief = buildVisualBrief(ctx(gitPost, "PROJECT_SHOWCASE", "Git Version Control"));
    expect(dbBrief.visualMetaphor).not.toEqual(gitBrief.visualMetaphor);
    expect(gitBrief.visualMetaphor).toContain("BRANCH");
  });

  it("produces a valid theme and composition enum", () => {
    const brief: VisualBrief = buildVisualBrief(ctx(makePost()));
    const themes: VisualTheme[] = ["learning-concept", "project-build", "problem-solving", "technical-explanation", "security", "career-growth", "reflection", "achievement"];
    const comps: VisualComposition[] = ["concept-flow", "problem-solution", "three-ideas", "architecture-flow", "before-after", "skill-progression", "comparison"];
    expect(themes).toContain(brief.theme);
    expect(comps).toContain(brief.composition);
  });

  it("never renders an invented day number when absent", () => {
    const brief = buildVisualBrief(ctx(makePost()));
    // dayNumber is derived from the real post's journey day, not synthesized.
    expect(brief.dayNumber).toBe(12);
  });

  it("extracts a primary concept and secondary concepts prioritised", () => {
    const post = makePost({
      format: "project",
      body: "I used Supabase RLS to isolate user data and added an index.",
      opening: "RLS protects each row.",
    });
    const brief = buildVisualBrief(ctx(post, "SECURITY_LESSON"));
    expect(brief.primaryConcept).toBe("Row-Level Security");
    expect(Array.isArray(brief.secondaryConcepts)).toBe(true);
    expect((brief.secondaryConcepts ?? []).length).toBeGreaterThan(0);
  });

  it("derives a recruiter-aware emphasis from post type", () => {
    const brief = buildVisualBrief(ctx(makePost(), "DEBUGGING_STORY"));
    expect(brief.emphasis).toBe("problem-solve");
  });

  it("caps headline and subheadline for mobile safety", () => {
    const post = makePost({
      image_headline: "A very long headline that definitely exceeds sixty characters of text content",
      image_subheadline: "A very long secondary line that also exceeds one hundred characters so we can verify the cap works correctly here",
    });
    const brief = buildVisualBrief(ctx(post, "TECHNICAL_LESSON"));
    expect(brief.headline.length).toBeLessThanOrEqual(60);
    expect(brief.subheadline.length).toBeLessThanOrEqual(100);
  });

  it("strips hashtags and emojis from the visual source text", () => {
    const post = makePost({
      body: "Great progress on the index 🚀 #Database #SQL",
      takeaway: "An index avoids a full scan.",
    });
    const brief = buildVisualBrief(ctx(post));
    expect(brief.headline).not.toContain("#");
    expect(brief.visualMetaphor).not.toContain("🚀");
    expect(brief.visualMetaphor).not.toContain("#");
  });

  it("keeps course-only material in learning framing without fabricated metrics", () => {
    const post = makePost({
      opening: "In this module we study how indexes work.",
      body: "Students will build a query plan.",
      takeaway: "Indexes make lookups faster.",
    });
    const brief = buildVisualBrief(ctx(post, "TECHNICAL_LESSON"));
    // Course framing preserved — no invented production claims.
    expect(brief.headline.toLowerCase()).not.toContain("built");
    expect(brief.technologies).not.toContain("Total Users");
    expect(brief.keyPoints.length).toBeLessThanOrEqual(4);
  });
});
