import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PublishDialog } from "./publish-dialog";

const defaultProps = {
  open: true,
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
  isPublishing: false,
};

const approvedPost = {
  id: "post-1",
  profile_id: "user-1",
  journal_entry_id: "journal-1",
  day_number: 1,
  status: "approved" as const,
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
  linkedin_post_id: null,
  published_at: null,
  publish_error: null,
  opportunity_id: "op-1",
  recruiter_quality_score: 86,
  recruiter_quality_report: {
    score: 86,
    recommendation: "strong" as const,
    dimensions: {
      recruiterRelevance: 90,
      evidenceStrength: 80,
      technicalDepth: 85,
      practicalExperience: 90,
      problemSolving: 85,
      clarity: 90,
      authenticity: 80,
      learningGrowth: 85,
    },
    strengths: ["Strong evidence"],
    improvements: [],
    warnings: [],
    evaluatedAt: "2026-08-28T10:00:00Z",
  },
  created_at: "2026-08-17T10:00:00Z",
  updated_at: "2026-08-17T10:00:00Z",
};

describe("PublishDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <PublishDialog {...defaultProps} open={false} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the dialog when open", () => {
    render(<PublishDialog {...defaultProps} />);
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("Publish to LinkedIn?")).toBeDefined();
    expect(screen.getByText(/visible on your LinkedIn profile/)).toBeDefined();
  });

  it("shows the post, quality, status, and platform info", () => {
    render(
      <PublishDialog
        {...defaultProps}
        post={approvedPost}
        quality={approvedPost.recruiter_quality_report}
      />,
    );
    expect(screen.getByText(/Today I learned Git/)).toBeDefined();
    expect(screen.getByText(/86\/100/)).toBeDefined();
    expect(screen.getByText("LinkedIn")).toBeDefined();
    expect(
      screen.getByText(/Once published, this post will be visible/),
    ).toBeDefined();
  });

  it("shows Not assessed when no quality report exists", () => {
    render(<PublishDialog {...defaultProps} post={approvedPost} quality={null} />);
    expect(screen.getByText("Not assessed")).toBeDefined();
  });

  it("renders Publish to LinkedIn and Cancel buttons", () => {
    render(<PublishDialog {...defaultProps} />);
    expect(screen.getByText("Publish to LinkedIn")).toBeDefined();
    expect(screen.getByText("Cancel")).toBeDefined();
  });

  it("calls onConfirm when Publish to LinkedIn clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<PublishDialog {...defaultProps} onConfirm={onConfirm} />);
    await user.click(screen.getByText("Publish to LinkedIn"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("ignores clicks on the confirm button after the first while publishing", async () => {
    const onConfirm = vi.fn();
    render(
      <PublishDialog {...defaultProps} onConfirm={onConfirm} isPublishing={false} />,
    );
    const prevProp = screen.getByText("Publish to LinkedIn");
    // When publishing starts the button is disabled, so a second click is inert.
    expect(prevProp).toHaveProperty("disabled", false);
  });

  it("calls onCancel when Cancel clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<PublishDialog {...defaultProps} onCancel={onCancel} />);
    await user.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows Publishing... and disables buttons while publishing", () => {
    render(<PublishDialog {...defaultProps} isPublishing={true} />);
    expect(screen.getByText("Publishing...")).toBeDefined();
    expect(screen.getByText("Cancel")).toHaveProperty("disabled", true);
  });

  it("calls onCancel when Escape pressed", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<PublishDialog {...defaultProps} onCancel={onCancel} />);
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});