import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostCard } from "./post-card";

const mockPost = {
  id: "post-1",
  profile_id: "user-1",
  journal_entry_id: "journal-1",
  day_number: 1,
  status: "draft" as const,
  format: "what-i-learned" as const,
  opening: "Today I learned Git.",
  body: "Git is a version control system that helps track changes in code over time.",
  takeaway: "Git saves versions.",
  next_step: "Learn branches.",
  hashtags: ["#105DaysOfCode", "#Git", "#Learning"],
  image_headline: null,
  image_subheadline: null,
  image_keywords: null,
  image_visual_concept: null,
  image_template: null,
  provider: "fallback",
  model: "template-v1",
  tokens_used: null,
  content_hash: "abc123",
  opportunity_id: null,
  recruiter_quality_score: null,
  recruiter_quality_report: null,
  linkedin_post_id: null,
  published_at: null,
  publish_error: null,
  created_at: "2026-08-17T10:00:00Z",
  updated_at: "2026-08-17T10:00:00Z",
};

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

describe("PostCard", () => {
  it("renders day number", () => {
    render(<PostCard post={mockPost} />);
    expect(screen.getByText("Day 1 / 105")).toBeDefined();
  });

  it("renders format label", () => {
    render(<PostCard post={mockPost} />);
    expect(screen.getByText("What I Learned")).toBeDefined();
  });

  it("renders opening text", () => {
    render(<PostCard post={mockPost} />);
    expect(screen.getByText("Today I learned Git.")).toBeDefined();
  });

  it("renders status badge", () => {
    render(<PostCard post={mockPost} />);
    expect(screen.getByText("Draft")).toBeDefined();
  });

  it("renders hashtags", () => {
    render(<PostCard post={mockPost} />);
    expect(screen.getByText("#105DaysOfCode")).toBeDefined();
    expect(screen.getByText("#Git")).toBeDefined();
    expect(screen.getByText("#Learning")).toBeDefined();
  });

  it("shows Edit link for draft posts", () => {
    render(<PostCard post={mockPost} />);
    const link = screen.getByText("Edit");
    expect(link.getAttribute("href")).toBe("/posts/post-1");
  });

  it("shows Review link for approved posts", () => {
    const approvedPost = { ...mockPost, status: "approved" as const };
    render(<PostCard post={approvedPost} />);
    const link = screen.getByText("Review");
    expect(link.getAttribute("href")).toBe("/posts/post-1");
  });

  it("truncates long body text", () => {
    const longPost = { ...mockPost, body: "A".repeat(200) };
    render(<PostCard post={longPost} />);
    const text = screen.getByText(/A+\.\.\./);
    expect(text).toBeDefined();
  });

  it("shows hashtag count when more than 3", () => {
    const postWithManyHashtags = {
      ...mockPost,
      hashtags: ["#1", "#2", "#3", "#4", "#5"],
    };
    render(<PostCard post={postWithManyHashtags} />);
    expect(screen.getByText("+2")).toBeDefined();
  });

  it("shows the quality chip for an assessed opportunity post", () => {
    const assessed = {
      ...mockPost,
      recruiter_quality_score: 86,
      recruiter_quality_report: {
        score: 86,
        recommendation: "strong" as const,
        dimensions: qualityDimensions,
        strengths: [],
        improvements: [],
        warnings: [],
        evaluatedAt: "2026-08-28T10:00:00Z",
      },
    };
    render(<PostCard post={assessed} />);
    expect(screen.getByText(/Post quality 86\/100/)).toBeDefined();
  });

  it("flags a do_not_publish post as not approved for publishing", () => {
    const blocked = {
      ...mockPost,
      recruiter_quality_score: 50,
      recruiter_quality_report: {
        score: 50,
        recommendation: "do_not_publish" as const,
        dimensions: qualityDimensions,
        strengths: [],
        improvements: [],
        warnings: ["Critical: the post makes a personal achievement claim."],
        evaluatedAt: "2026-08-28T10:00:00Z",
      },
    };
    render(<PostCard post={blocked} />);
    expect(screen.getByText("Not approved for publishing")).toBeDefined();
  });

  it("shows Published to LinkedIn metadata for published posts", () => {
    const published = {
      ...mockPost,
      status: "published" as const,
      linkedin_post_id: "urn:li:share:123",
      published_at: "2026-08-28T10:00:00Z",
    };
    render(<PostCard post={published} />);
    expect(screen.getAllByText(/Published to LinkedIn/).length).toBeGreaterThan(0);
    expect(screen.getByText("View").getAttribute("href")).toBe("/posts/post-1");
  });
});
