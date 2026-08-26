import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { PagePreview } from "./page-preview";

const pages = [
  { pageNumber: 1, text: "Page one content about Git basics." },
  { pageNumber: 2, text: "Page two content about terminal commands." },
  { pageNumber: 3, text: "Page three content about collections." },
];

describe("PagePreview", () => {
  it("renders page count and navigation", () => {
    render(<PagePreview pages={pages} />);
    expect(screen.getByText("Document Preview")).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("displays the text of the current page", () => {
    render(<PagePreview pages={pages} />);
    expect(screen.getByText("Page one content about Git basics.")).toBeInTheDocument();
  });

  it("navigates to next page", () => {
    render(<PagePreview pages={pages} />);
    fireEvent.click(screen.getByLabelText("Next page"));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByText("Page two content about terminal commands.")).toBeInTheDocument();
  });

  it("navigates to previous page", () => {
    render(<PagePreview pages={pages} />);
    fireEvent.click(screen.getByLabelText("Next page"));
    fireEvent.click(screen.getByLabelText("Previous page"));
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("disables previous button on first page", () => {
    render(<PagePreview pages={pages} />);
    expect(screen.getByLabelText("Previous page")).toBeDisabled();
  });

  it("disables next button on last page", () => {
    render(<PagePreview pages={pages} />);
    fireEvent.click(screen.getByLabelText("Next page"));
    fireEvent.click(screen.getByLabelText("Next page"));
    expect(screen.getByLabelText("Next page")).toBeDisabled();
  });

  it("starts on highlighted page when provided", () => {
    render(<PagePreview pages={pages} highlightPage={2} />);
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByText("Page two content about terminal commands.")).toBeInTheDocument();
  });

  it("shows empty state for no pages", () => {
    render(<PagePreview pages={[]} />);
    expect(screen.getByText("No extracted pages available.")).toBeInTheDocument();
  });

  it("shows message for empty page text", () => {
    const emptyPages = [{ pageNumber: 1, text: "" }];
    render(<PagePreview pages={emptyPages} />);
    expect(screen.getByText("This page contains no extractable text.")).toBeInTheDocument();
  });

  it("renders page dots for small document counts", () => {
    render(<PagePreview pages={pages} />);
    // Should have 3 page dot buttons
    const dots = screen.getAllByRole("button", { name: /Go to page/ });
    expect(dots).toHaveLength(3);
  });

  it("navigates via page dots", () => {
    render(<PagePreview pages={pages} />);
    const dots = screen.getAllByRole("button", { name: /Go to page/ });
    fireEvent.click(dots[1]!);
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("calls onNavigateToPage when navigating", () => {
    const onNavigate = vi.fn();
    render(<PagePreview pages={pages} onNavigateToPage={onNavigate} />);
    fireEvent.click(screen.getByLabelText("Next page"));
    expect(onNavigate).toHaveBeenCalledWith(2);
  });
});
