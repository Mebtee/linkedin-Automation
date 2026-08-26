import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { EvidencePanel } from "./evidence-panel";
import type { JournalFieldSource } from "@/types/course-material";

describe("EvidencePanel", () => {
  const pdfSource: JournalFieldSource = {
    field: "whatILearned",
    sourceType: "pdf",
    pageNumbers: [3, 4],
    confidence: "SUPPORTED_BY_PDF",
  };

  const missingSource: JournalFieldSource = {
    field: "whatIBuilt",
    sourceType: "missing",
    pageNumbers: [],
    confidence: "MISSING",
  };

  const userSource: JournalFieldSource = {
    field: "challenge",
    sourceType: "user",
    pageNumbers: [],
    confidence: "USER_CONFIRMED",
  };

  it("renders the expand trigger button", () => {
    render(<EvidencePanel source={pdfSource} />);
    expect(screen.getByText("Evidence details")).toBeInTheDocument();
  });

  it("expands to show evidence details when clicked", () => {
    render(<EvidencePanel source={pdfSource} />);
    fireEvent.click(screen.getByText("Evidence details"));

    expect(screen.getByText("PDF Evidence")).toBeInTheDocument();
    expect(screen.getByText("Course PDF")).toBeInTheDocument();
    expect(screen.getByText(/Pages 3–4/)).toBeInTheDocument();
  });

  it("shows missing field message for MISSING confidence", () => {
    render(<EvidencePanel source={missingSource} />);
    fireEvent.click(screen.getByText("Evidence details"));

    expect(screen.getByText("Not Found")).toBeInTheDocument();
    expect(screen.getByText(/Not found in the course material/)).toBeInTheDocument();
  });

  it("shows user confirmed badge for USER_CONFIRMED", () => {
    render(<EvidencePanel source={userSource} />);
    fireEvent.click(screen.getByText("Evidence details"));

    expect(screen.getByText("User Confirmed")).toBeInTheDocument();
    expect(screen.getByText("User Input")).toBeInTheDocument();
  });

  it("shows single page link for single page source", () => {
    const singlePage: JournalFieldSource = {
      field: "keyTakeaway",
      sourceType: "pdf",
      pageNumbers: [5],
      confidence: "SUPPORTED_BY_PDF",
    };
    render(<EvidencePanel source={singlePage} />);
    fireEvent.click(screen.getByText("Evidence details"));

    expect(screen.getByText("Page 5")).toBeInTheDocument();
  });

  it("calls onNavigateToPage when page link is clicked", () => {
    const onNavigate = vi.fn();
    render(<EvidencePanel source={pdfSource} onNavigateToPage={onNavigate} />);
    fireEvent.click(screen.getByText("Evidence details"));
    fireEvent.click(screen.getByText(/Pages 3–4/));

    expect(onNavigate).toHaveBeenCalledWith(3);
  });

  it("renders nothing when source is undefined", () => {
    const { container } = render(<EvidencePanel source={undefined} />);
    expect(container.innerHTML).toBe("");
  });

  it("collapses when clicked again", () => {
    render(<EvidencePanel source={pdfSource} />);
    const button = screen.getByText("Evidence details");
    fireEvent.click(button);
    expect(screen.getByText("PDF Evidence")).toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.queryByText("PDF Evidence")).not.toBeInTheDocument();
  });
});
