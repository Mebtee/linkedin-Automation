import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OpportunitySummaryPanel } from "./opportunity-summary-panel";
import type { ContentOpportunityRow } from "@/types/content-opportunity";

const opportunity: ContentOpportunityRow = {
  id: "op-1",
  profile_id: "profile-1",
  source_type: "journal",
  source_id: "entry-1",
  day_number: 42,
  module_number: null,
  post_type: "PROJECT_SHOWCASE",
  content_goal: "SHOW_PROJECTS",
  title: "Built a Supabase-backed rate limiter",
  summary: "A real project summary for recruiters.",
  evidence: [
    {
      field: "whatIBuilt",
      pageNumbers: [] as number[],
      confidence: "USER_CONFIRMED",
    },
  ],
  recruiter_score: 82,
  recruiter_score_breakdown: null,
  selection_reason: "Strong implementation evidence with clear recruiter appeal.",
  status: "generated",
  dedup_key: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("OpportunitySummaryPanel", () => {
  it("renders the empty state when no opportunity is linked", () => {
    render(<OpportunitySummaryPanel opportunity={null} />);
    expect(screen.getByText("Selected Opportunity")).toBeDefined();
    expect(screen.getByText(/not linked to a content opportunity/)).toBeDefined();
  });

  it("renders the stored opportunity metadata without recomputing scores", () => {
    render(<OpportunitySummaryPanel opportunity={opportunity} />);
    expect(screen.getByText("Selected Opportunity")).toBeDefined();
    expect(screen.getByText("Project Showcase")).toBeDefined();
    expect(screen.getByText("Show projects")).toBeDefined();
    expect(screen.getByText("82/100")).toBeDefined();
    expect(screen.getByText("42")).toBeDefined();
    expect(screen.getByText("generated")).toBeDefined();
    expect(screen.getByText(/Strong implementation evidence/)).toBeDefined();
  });
});