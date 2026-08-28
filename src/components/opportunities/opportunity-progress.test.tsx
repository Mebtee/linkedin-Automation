import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OpportunityProgress } from "./opportunity-progress";
import type { GeneratedPostRow, GeneratedPostStatus } from "@/types/generated-post";
import type { PublishRecommendation } from "@/types/recruiter-quality";

const qualityDimensions = {
  evidenceStrength: 90,
  practicalExperience: 80,
  technicalDepth: 70,
  problemSolving: 85,
  clarity: 80,
  authenticity: 85,
  learningGrowth: 80,
  recruiterRelevance: 80,
};

function makePost(status: GeneratedPostStatus, recommendation: PublishRecommendation = "ready") {
  return {
    id: "post-1",
    profile_id: "user-1",
    journal_entry_id: "journal-1",
    day_number: 1,
    status,
    format: "what-i-learned" as const,
    opening: "Opening",
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
    opportunity_id: "op-1",
    recruiter_quality_score: 50,
    recruiter_quality_report: {
      score: 50,
      recommendation,
      dimensions: qualityDimensions,
      strengths: [],
      improvements: [],
      warnings: [],
      evaluatedAt: "2026-08-17T10:00:00Z",
    },
    linkedin_post_id: null,
    published_at: null,
    publish_error: null,
    created_at: "2026-08-17T10:00:00Z",
    updated_at: "2026-08-17T10:00:00Z",
  } satisfies GeneratedPostRow;
}

describe("OpportunityProgress", () => {
  it("starts at Opportunity for a candidate", () => {
    render(<OpportunityProgress status="candidate" post={null} postRecommendation={null} />);
    expect(screen.getByText("Opportunity")).toBeDefined();
    expect(screen.getByText("Generated")).toBeDefined();
    expect(screen.getByText("Reviewed")).toBeDefined();
    expect(screen.getByText("Approved")).toBeDefined();
    expect(screen.getByText("Published")).toBeDefined();
  });

  it("marks Reviewed for a generated post with a strong recommendation", () => {
    render(
      <OpportunityProgress
        status="generated"
        post={makePost("draft", "strong")}
        postRecommendation="strong"
      />,
    );
    expect(screen.getByText("Reviewed")).toBeDefined();
  });

  it("marks Approved when the post is approved", () => {
    render(
      <OpportunityProgress
        status="approved"
        post={makePost("approved")}
        postRecommendation="strong"
      />,
    );
    expect(screen.getByText("Approved")).toBeDefined();
  });

  it("marks Published when the post is live", () => {
    render(
      <OpportunityProgress
        status="published"
        post={makePost("published")}
        postRecommendation={null}
      />,
    );
    expect(screen.getByText("Published")).toBeDefined();
  });

  it("flips the generated step into a blocking state for do_not_publish", () => {
    render(
      <OpportunityProgress
        status="generated"
        post={makePost("draft", "do_not_publish")}
        postRecommendation="do_not_publish"
      />,
    );
    expect(screen.getByText("Generated")).toBeDefined();
  });
});