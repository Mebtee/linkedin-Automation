import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OpportunityGenerateCard } from "./opportunity-generate-card";

vi.mock("@/app/actions/content-opportunities", () => ({
  generatePostFromOpportunityAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const defaultOpportunity = {
  id: "opp-1",
  profile_id: "profile-1",
  source_type: "journal" as const,
  source_id: "entry-1",
  day_number: 42,
  module_number: null,
  post_type: "PROJECT_SHOWCASE" as const,
  content_goal: "SHOW_PROJECTS" as const,
  title: "Built a Supabase-backed rate limiter",
  summary: "A real project summary for recruiters.",
  evidence: [
    {
      field: "whatIBuilt",
      pageNumbers: [] as number[],
      confidence: "USER_CONFIRMED" as const,
    },
  ],
  recruiter_score: 82,
  recruiter_score_breakdown: null,
  selection_reason: "Strong implementation evidence with clear recruiter appeal.",
  status: "selected" as const,
  dedup_key: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("OpportunityGenerateCard", () => {
  it("renders the opportunity title and post type", () => {
    render(<OpportunityGenerateCard opportunity={defaultOpportunity} />);
    expect(screen.getByText("Built a Supabase-backed rate limiter")).toBeDefined();
    expect(screen.getByText("Project Showcase")).toBeDefined();
    expect(screen.getByText("Show projects")).toBeDefined();
  });

  it("shows the recruiter score", () => {
    render(<OpportunityGenerateCard opportunity={defaultOpportunity} />);
    expect(screen.getByText("Score 82/100")).toBeDefined();
  });

  it("shows the selection reason", () => {
    render(<OpportunityGenerateCard opportunity={defaultOpportunity} />);
    expect(
      screen.getByText(/Strong implementation evidence with clear recruiter appeal/i),
    ).toBeDefined();
  });

  it("shows a Generate Post button for a selected opportunity", () => {
    render(<OpportunityGenerateCard opportunity={defaultOpportunity} />);
    expect(screen.getByText("Generate Post")).toBeDefined();
  });
});