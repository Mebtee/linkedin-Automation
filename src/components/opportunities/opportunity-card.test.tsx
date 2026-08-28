import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpportunityCard } from "./opportunity-card";

vi.mock("@/app/actions/content-opportunities", () => ({
  generatePostFromOpportunityAction: vi.fn(),
}));
vi.mock("@/app/actions/generated-posts", () => ({
  publishPost: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const baseOpportunity = {
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
  status: "candidate" as const,
  dedup_key: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const needsReviewReport = {
  score: 60,
  recommendation: "needs_review" as const,
  dimensions: {},
  strengths: [],
  improvements: [],
  warnings: ["Review the flagged area."],
  evaluatedAt: "2026-08-28T10:00:00Z",
};

const doNotPublishReport = {
  score: 50,
  recommendation: "do_not_publish" as const,
  dimensions: {},
  strengths: [],
  improvements: [],
  warnings: ["Critical: the post makes a personal achievement claim."],
  evaluatedAt: "2026-08-28T10:00:00Z",
};

const strongReport = {
  score: 90,
  recommendation: "strong" as const,
  dimensions: {},
  strengths: [],
  improvements: [],
  warnings: [],
  evaluatedAt: "2026-08-28T10:00:00Z",
};

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    profile_id: "user-1",
    journal_entry_id: "journal-1",
    day_number: 1,
    status: "draft" as const,
    format: "what-i-learned" as const,
    opening: "Today I learned Git.",
    body: "Git is a version control system.",
    takeaway: "Git saves versions.",
    next_step: "Learn branches.",
    hashtags: ["#105DaysOfCode"],
    image_headline: null,
    image_subheadline: null,
    image_keywords: null,
    image_visual_concept: null,
    image_template: null,
    provider: "fallback",
    model: "template-v1",
    tokens_used: null,
    content_hash: "abc123",
    opportunity_id: "opp-1",
    recruiter_quality_score: null,
    recruiter_quality_report: null,
    linkedin_post_id: null,
    published_at: null,
    publish_error: null,
    created_at: "2026-08-17T10:00:00Z",
    updated_at: "2026-08-17T10:00:00Z",
    ...overrides,
  };
}

describe("OpportunityCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a Generate Post button for candidate/selected opportunities", () => {
    render(<OpportunityCard opportunity={baseOpportunity} post={null} />);
    expect(screen.getByText("Generate Post")).toBeDefined();
    expect(screen.getByText("Score 82/100")).toBeDefined();
  });

  it("shows the exploration progress stepper", () => {
    render(<OpportunityCard opportunity={baseOpportunity} post={null} />);
    expect(screen.getByLabelText("Opportunity progress")).toBeDefined();
    expect(screen.getByText("Opportunity")).toBeDefined();
    expect(screen.getByText("Published")).toBeDefined();
  });

  it("shows topic context when provided", () => {
    render(
      <OpportunityCard opportunity={baseOpportunity} post={null} topic="Databases" />,
    );
    expect(screen.getByText("Databases")).toBeDefined();
  });

  it("links to the draft with a Review Draft action for a needs_review generated post", () => {
    const post = makePost({
      status: "draft" as const,
      recruiter_quality_score: 60,
      recruiter_quality_report: needsReviewReport,
    });
    render(
      <OpportunityCard
        opportunity={{ ...baseOpportunity, status: "generated" as const }}
        post={post}
      />,
    );
    expect(screen.getByText(/Post quality 60\/100/)).toBeDefined();
    const link = screen.getByText("Review Draft").closest("a");
    expect(link?.getAttribute("href")).toBe("/posts/post-1");
    expect(screen.getByText(/Review the flagged areas/)).toBeDefined();
  });

  it("links to the draft with Review Issues for a do_not_publish generated post", () => {
    const post = makePost({
      status: "draft" as const,
      recruiter_quality_score: 50,
      recruiter_quality_report: doNotPublishReport,
    });
    render(
      <OpportunityCard
        opportunity={{ ...baseOpportunity, status: "generated" as const }}
        post={post}
      />,
    );
    expect(screen.getByText("Review Issues")).toBeDefined();
    expect(screen.getByText(/Fix the blocking issue before this can be approved/)).toBeDefined();
  });

  it("offers Publish to LinkedIn only when the post is approved", async () => {
    const user = userEvent.setup();
    const approvedPost = makePost({
      status: "approved" as const,
      recruiter_quality_score: 90,
      recruiter_quality_report: strongReport,
    });
    const { publishPost } = await import("@/app/actions/generated-posts");
    (publishPost as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      post: makePost({ status: "published" as const }),
    });

    render(
      <OpportunityCard
        opportunity={{ ...baseOpportunity, status: "approved" as const }}
        post={approvedPost}
      />,
    );

    await user.click(screen.getByText("Publish to LinkedIn"));
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText(/Once published, this post will be visible/)).toBeDefined();

    // Dialog shows the approved post's quality.
    expect(screen.getAllByText(/90\/100/).length).toBeGreaterThan(0);

    await user.click(screen.getAllByText("Publish to LinkedIn")[1]!);
    expect(publishPost).toHaveBeenCalledWith("post-1");
  });

  it("does not offer Publish when the opportunity is approved but the post is an unapproved draft", () => {
    const draftPost = makePost({
      status: "draft" as const,
      recruiter_quality_report: needsReviewReport,
    });
    render(
      <OpportunityCard
        opportunity={{ ...baseOpportunity, status: "approved" as const }}
        post={draftPost}
      />,
    );
    expect(screen.queryByText("Publish to LinkedIn")).toBeNull();
  });

  it("links to the published post and shows Published to LinkedIn feedback", () => {
    const publishedPost = makePost({
      status: "published" as const,
      linkedin_post_id: "urn:li:share:1",
      published_at: "2026-08-28T10:00:00Z",
    });
    render(
      <OpportunityCard
        opportunity={{ ...baseOpportunity, status: "published" as const }}
        post={publishedPost}
      />,
    );
    expect(screen.getAllByText(/Published to LinkedIn/).length).toBeGreaterThan(0);
    const link = screen.getByText("View Published Post").closest("a");
    expect(link?.getAttribute("href")).toBe("/posts/post-1");
  });

  it("shows a generate button again when the linked draft was deleted", () => {
    render(
      <OpportunityCard
        opportunity={{ ...baseOpportunity, status: "generated" as const }}
        post={null}
      />,
    );
    expect(screen.getByText("Generate Post")).toBeDefined();
    expect(screen.getByText(/Open the draft to review/)).toBeDefined();
  });
});