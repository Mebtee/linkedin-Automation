import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostPreview } from "./post-preview";

describe("PostPreview", () => {
  const defaultProps = {
    opening: "Today I learned Git.",
    body: "Git is a version control system.",
    takeaway: "Git saves versions.",
    nextStep: "Learn branches.",
    hashtags: ["#105DaysOfCode", "#Git"],
  };

  it("renders opening", () => {
    render(<PostPreview {...defaultProps} />);
    expect(screen.getByText("Today I learned Git.")).toBeDefined();
  });

  it("renders body", () => {
    render(<PostPreview {...defaultProps} />);
    expect(screen.getByText("Git is a version control system.")).toBeDefined();
  });

  it("renders takeaway", () => {
    render(<PostPreview {...defaultProps} />);
    expect(screen.getByText("Git saves versions.")).toBeDefined();
  });

  it("renders next step", () => {
    render(<PostPreview {...defaultProps} />);
    expect(screen.getByText(/Learn branches/)).toBeDefined();
  });

  it("renders hashtags", () => {
    render(<PostPreview {...defaultProps} />);
    expect(screen.getByText("#105DaysOfCode")).toBeDefined();
    expect(screen.getByText("#Git")).toBeDefined();
  });

  it("renders preview label", () => {
    render(<PostPreview {...defaultProps} />);
    expect(screen.getByText("Preview")).toBeDefined();
    expect(screen.getByText("Approximate LinkedIn preview")).toBeDefined();
  });

  it("renders empty state when no content", () => {
    render(
      <PostPreview opening="" body="" takeaway="" nextStep="" hashtags={[]} />,
    );
    expect(screen.getByText("Preview")).toBeDefined();
  });
});
