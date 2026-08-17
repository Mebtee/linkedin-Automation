import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostStatusBadge } from "./post-status-badge";

describe("PostStatusBadge", () => {
  it("renders draft status", () => {
    render(<PostStatusBadge status="draft" />);
    expect(screen.getByText("Draft")).toBeDefined();
    expect(screen.getByText("You can keep editing.")).toBeDefined();
  });

  it("renders approved status", () => {
    render(<PostStatusBadge status="approved" />);
    expect(screen.getByText("Approved")).toBeDefined();
    expect(screen.getByText("Ready for the next step.")).toBeDefined();
  });

  it("renders published status", () => {
    render(<PostStatusBadge status="published" />);
    expect(screen.getByText("Published")).toBeDefined();
    expect(screen.getByText("Published to LinkedIn.")).toBeDefined();
  });

  it("renders failed status", () => {
    render(<PostStatusBadge status="failed" />);
    expect(screen.getByText("Failed")).toBeDefined();
    expect(screen.getByText("Something went wrong.")).toBeDefined();
  });

  it("has role=status", () => {
    render(<PostStatusBadge status="draft" />);
    expect(screen.getByRole("status")).toBeDefined();
  });
});
