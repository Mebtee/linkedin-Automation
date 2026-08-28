import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OpportunitiesClient } from "./opportunities-client";
import type { ContentOpportunityRow, ContentOpportunityStatus } from "@/types/content-opportunity";
import type { GeneratedPostRow, GeneratedPostStatus } from "@/types/generated-post";
import type { PublishRecommendation } from "@/types/recruiter-quality";

vi.mock("@/app/actions/content-opportunities", () => ({
  generatePostFromOpportunityAction: vi.fn(),
  getPostQualityForOpportunityAction: vi.fn(),
}));
vi.mock("@/app/actions/generated-posts", () => ({
  publishPost: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const qualityDimensions = {
  evidenceStrength: 95,
  practicalExperience: 90,
  technicalDepth: 75,
  problemSolving: 80,
  clarity: 85,
  authenticity: 90,
  learningGrowth: 85,
  recruiterRelevance: 88,
};

function makeOpportunity(id: string, status: ContentOpportunityStatus, score: number) {
  return {
    id,
    profile_id: "profile-1",
    source_type: "journal" as const,
    source_id: `entry-${id}`,
    day_number: 42,
    module_number: null,
    post_type: "PROJECT_SHOWCASE" as const,
    content_goal: "SHOW_PROJECTS" as const,
    title: `Opportunity ${id}`,
    summary: "Summary",
    evidence: [
      {
        field: "whatIBuilt",
        pageNumbers: [] as number[],
        confidence: "USER_CONFIRMED" as const,
      },
    ],
    recruiter_score: score,
    recruiter_score_breakdown: null,
    selection_reason: null,
    status,
    dedup_key: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  } satisfies ContentOpportunityRow;
}

function makePost(
  opportunityId: string,
  recommendation: PublishRecommendation,
  status: GeneratedPostStatus = "draft",
) {
  return {
    id: `post-${opportunityId}`,
    profile_id: "profile-1",
    journal_entry_id: "journal-1",
    day_number: 1,
    status,
    format: "what-i-learned" as const,
    opening: `Opening ${opportunityId}`,
    body: "Body",
    takeaway: "Takeaway",
    next_step: "Next",
    hashtags: ["#105"],
    image_headline: null,
    image_subheadline: null,
    image_keywords: null,
    image_visual_concept: null,
    image_template: null,
    provider: "fallback",
    model: "template-v1",
    tokens_used: null,
    content_hash: "abc",
    opportunity_id: opportunityId,
    recruiter_quality_score: recommendation === "strong" ? 90 : 50,
    recruiter_quality_report: {
      score: recommendation === "strong" ? 90 : 50,
      recommendation,
      dimensions: qualityDimensions,
      strengths: [],
      improvements: [],
      warnings: [],
      evaluatedAt: "2026-08-28T10:00:00Z",
    },
    linkedin_post_id: null,
    published_at: null,
    publish_error: null,
    created_at: "2026-08-17T10:00:00Z",
    updated_at: "2026-08-17T10:00:00Z",
  } as const satisfies GeneratedPostRow;
}

describe("OpportunitiesClient", () => {
  it("shows the featured recommendation when present", () => {
    const recommended = makeOpportunity("opp-rec", "selected", 95);
    render(
      <OpportunitiesClient
        opportunities={[recommended, makeOpportunity("opp-c", "candidate", 70)]}
        posts={[]}
        recommended={{
          opportunity: recommended,
          reason: "Strong evidence",
          diversityAdjusted: false,
          topic: "Databases",
          moduleTitle: "Storage",
        }}
      />,
    );
    expect(screen.getByText("Recommended for You")).toBeDefined();
    expect(screen.getByText("Databases")).toBeDefined();
    expect(screen.getByText("Storage")).toBeDefined();
    // The featured opportunity is not repeated in Ready to Generate.
    expect(screen.getByText("Ready to Generate")).toBeDefined();
    expect(screen.getByText("Opportunity opp-c")).toBeDefined();
    expect(screen.queryByText("Opportunity opp-rec")).toBeDefined();
  });

  it("groups needs_review generated posts into Needs Review", () => {
    const needsReview = makeOpportunity("opp-n", "generated", 70);
    const posts = [makePost("opp-n", "needs_review")];
    render(
      <OpportunitiesClient
        opportunities={[needsReview]}
        posts={posts}
        recommended={null}
      />,
    );
    expect(screen.getByText("Needs Review")).toBeDefined();
    expect(screen.queryByText("Generated", { selector: "h2" })).toBeNull();
  });

  it("groups do_not_publish generated posts into Blocked", () => {
    const blocked = makeOpportunity("opp-b", "generated", 60);
    const posts = [makePost("opp-b", "do_not_publish")];
    render(
      <OpportunitiesClient
        opportunities={[blocked]}
        posts={posts}
        recommended={null}
      />,
    );
    expect(screen.getByText("Blocked")).toBeDefined();
  });

  it("groups approved and published posts into their sections", () => {
    const approved = makeOpportunity("opp-a", "approved", 90);
    const published = makeOpportunity("opp-p", "published", 88);
    const posts = [
      makePost("opp-a", "strong", "approved"),
      makePost("opp-p", "strong", "published"),
    ];
    render(
      <OpportunitiesClient
        opportunities={[approved, published]}
        posts={posts}
        recommended={null}
      />,
    );
    expect(
      screen.getAllByRole("heading", { name: "Approved" }),
    ).toHaveLength(1);
    expect(
      screen.getAllByRole("heading", { name: "Published" }),
    ).toHaveLength(1);
  });

  it("shows the strategy panel and the empty state without opportunities", () => {
    render(
      <OpportunitiesClient
        opportunities={[]}
        posts={[]}
        recommended={null}
      />,
    );
    expect(screen.getByText("Recruiter Content Strategy")).toBeDefined();
    expect(
      screen.getByText(/No opportunities yet/),
    ).toBeDefined();
  });
});