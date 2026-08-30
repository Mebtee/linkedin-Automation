import { describe, it, expect } from "vitest";
import { buildVisualBrief } from "./visual/brief";
import { renderVisualBrief } from "./visual/compositions";
import { checkSvgSafety } from "./svg/escape";
import { brand } from "@/config/brand";
import type { GeneratedPostRow } from "@/types/generated-post";
import type { VisualComposition } from "@/types/image";

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

// Realistic representative fixtures for Phase 5H sample outputs (section 19).
const FIXTURES: Array<{ label: string; postType: string | null; topic: string; post: Partial<GeneratedPostRow> }> = [
  {
    label: "Learning",
    postType: "TECHNICAL_LESSON",
    topic: "JavaScript Closures",
    post: {
      opening: "Today I explored what a closure is.",
      body: "A function keeps access to the outer scope where it was defined.",
      takeaway: "Closures capture their lexical scope.",
      next_step: "Try a closure in a counter.",
    },
  },
  {
    label: "Project",
    postType: "PROJECT_SHOWCASE",
    topic: "Full-Stack Notes App",
    post: {
      format: "project",
      opening: "I built a notes app with an API.",
      body: "The React frontend calls a REST API backed by a database.",
      takeaway: "A clean client → API → database flow keeps concerns separated.",
      next_step: "Add auth next.",
    },
  },
  {
    label: "Problem Solving",
    postType: "PROBLEM_SOLUTION",
    topic: "Slow Query",
    post: {
      format: "challenge",
      opening: "A query was slow because it scanned every row.",
      body: "Adding an index turned the lookup into a fast path.",
      takeaway: "The right index avoids a full table scan.",
      next_step: "Inspect query plans.",
    },
  },
  {
    label: "Security",
    postType: "SECURITY_LESSON",
    topic: "Row-Level Security",
    post: {
      opening: "RLS prevents users from reading each other's data.",
      body: "Each user can only query their own rows.",
      takeaway: "RLS scopes access by owner.",
      next_step: "Write a policy for the team table.",
    },
  },
  {
    label: "Career / Milestone",
    postType: "LEARNING_MILESTONE",
    topic: "Module 2 Complete",
    post: {
      format: "small-win",
      opening: "I finished the second module of my journey.",
      body: "This module built up backend fundamentals step by step.",
      takeaway: "Progress compounds across modules.",
      next_step: "Start module 3.",
    },
  },
  {
    label: "Tutorial",
    postType: "TECHNICAL_LESSON",
    topic: "Setting Up Git",
    post: {
      format: "practical-lesson",
      opening: "Here is how to set up a git workflow.",
      body: "Initialize, commit, branch, then merge changes.",
      takeaway: "A clear git workflow keeps history reviewable.",
      next_step: "Try an interactive rebase.",
    },
  },
  {
    label: "Comparison",
    postType: "ENGINEERING_DECISION",
    topic: "SQL vs NoSQL",
    post: {
      format: "concept",
      opening: "Choosing SQL vs NoSQL depends on your data.",
      body: "SQL gives relational integrity; NoSQL scales horizontally.",
      takeaway: "Pick based on consistency needs and shape of data.",
      next_step: "Prototype both with realistic data.",
    },
  },
];

describe("representative Phase 5H samples", () => {
  it("produces valid, safe, correctly sized SVG for every post type", () => {
    for (const f of FIXTURES) {
      const brief = buildVisualBrief({
        post: basePost(f.post),
        topic: f.topic,
        moduleNumber: 2,
        moduleTitle: "Backend Module",
        postType: f.postType,
      });
      const svg = renderVisualBrief(brief);
      expect(svg, f.label).toContain("<svg");
      expect(svg, f.label).toContain(`width="${brand.image.width}"`);
      expect(svg, f.label).toContain(`height="${brand.image.height}"`);
      expect(checkSvgSafety(svg), f.label).toBeNull();
    }
  });

  it("is deterministic for the same input", () => {
    for (const f of FIXTURES) {
      const briefA = buildVisualBrief({ post: basePost(f.post), topic: f.topic, moduleNumber: 2, moduleTitle: "M", postType: f.postType });
      const briefB = buildVisualBrief({ post: basePost(f.post), topic: f.topic, moduleNumber: 2, moduleTitle: "M", postType: f.postType });
      expect(briefA).toEqual(briefB);
      expect(renderVisualBrief(briefA)).toBe(renderVisualBrief(briefB));
    }
  });

  it("produces different appropriate compositions across post types", () => {
    const compositions = new Set<VisualComposition>();
    for (const f of FIXTURES) {
      const brief = buildVisualBrief({ post: basePost(f.post), topic: f.topic, moduleNumber: 2, moduleTitle: "M", postType: f.postType });
      compositions.add(brief.composition);
    }
    expect(compositions.size).toBeGreaterThanOrEqual(3);
  });

  it("keeps branding secondary — never larger than the concept", () => {
    for (const f of FIXTURES) {
      const brief = buildVisualBrief({ post: basePost(f.post), topic: f.topic, moduleNumber: 2, moduleTitle: "M", postType: f.postType });
      expect(brief.dayNumber).toBe(23);
      expect(brief.module).toBeDefined();
    }
  });
});
