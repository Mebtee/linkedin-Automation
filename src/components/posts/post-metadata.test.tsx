import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostMetadata } from "./post-metadata";

const mockPost = {
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
  hashtags: ["#105DaysOfCode", "#Git"],
  image_headline: "Learning Git",
  image_subheadline: "Day 1 of my journey",
  image_keywords: ["git", "terminal", "coding"],
  image_visual_concept: "A laptop with Git terminal",
  image_template: "learner-progress",
  provider: "fallback",
  model: "template-v1",
  tokens_used: null,
  content_hash: "abc123",
  created_at: "2026-08-17T10:00:00Z",
  updated_at: "2026-08-17T10:00:00Z",
};

describe("PostMetadata", () => {
  it("renders post information section", () => {
    render(<PostMetadata post={mockPost} />);
    expect(screen.getByText("Post Information")).toBeDefined();
  });

  it("renders day number", () => {
    render(<PostMetadata post={mockPost} />);
    expect(screen.getByText("1 / 105")).toBeDefined();
  });

  it("renders format", () => {
    render(<PostMetadata post={mockPost} />);
    expect(screen.getByText("What I Learned")).toBeDefined();
  });

  it("renders provider", () => {
    render(<PostMetadata post={mockPost} />);
    expect(screen.getByText("fallback")).toBeDefined();
  });

  it("renders image preview section", () => {
    render(<PostMetadata post={mockPost} />);
    expect(screen.getByText("Image Metadata")).toBeDefined();
  });

  it("renders image metadata when present", () => {
    render(<PostMetadata post={mockPost} />);
    expect(screen.getByText("Learning Git")).toBeDefined();
    expect(screen.getByText("Day 1 of my journey")).toBeDefined();
    expect(screen.getByText("git, terminal, coding")).toBeDefined();
    expect(screen.getByText("A laptop with Git terminal")).toBeDefined();
    expect(screen.getByText("learner-progress")).toBeDefined();
  });

  it("shows no metadata message when image fields are null", () => {
    const postNoImages = {
      ...mockPost,
      image_headline: null,
      image_subheadline: null,
      image_keywords: null,
      image_visual_concept: null,
      image_template: null,
    };
    render(<PostMetadata post={postNoImages} />);
    expect(screen.getByText("No image metadata available.")).toBeDefined();
  });
});
