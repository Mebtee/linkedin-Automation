import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { CurriculumMatchPanel } from "./curriculum-match-panel";
import type { CourseJournalProposal } from "@/types/course-material";

function makeProposal(overrides: Partial<CourseJournalProposal> = {}): CourseJournalProposal {
  return {
    curriculumDay: 3,
    moduleNumber: 2,
    moduleTitle: "Python Data Structures",
    topic: "Collections, Files & Errors",
    matchConfidence: "HIGH",
    journal: {
      whatILearned: "Learned about dictionaries.",
      whatIPracticed: null,
      whatIBuilt: null,
      challenge: null,
      howISolvedIt: null,
      keyTakeaway: "Collections are fundamental.",
      tomorrowFocus: null,
      projectName: null,
      projectDescription: null,
      codeReference: null,
      resourcesUsed: "Course PDF: course.pdf",
      confidenceLevel: null,
      additionalNotes: null,
    },
    evidence: [],
    missingFields: [],
    warnings: [],
    candidates: [
      { dayNumber: 3, topic: "Collections", score: 0.92, moduleNumber: 2, moduleTitle: "Python Data Structures" },
      { dayNumber: 4, topic: "Web APIs", score: 0.45, moduleNumber: 2, moduleTitle: "Python Data Structures" },
    ],
    rationale: ["Topic 'Collections' strongly matches day 3"],
    builtBy: "deterministic",
    explicitDayMatch: false,
    ...overrides,
  };
}

describe("CurriculumMatchPanel", () => {
  it("renders day number, module, and topic", () => {
    render(<CurriculumMatchPanel proposal={makeProposal()} selectedDay={3} onDayChange={vi.fn()} />);
    expect(screen.getByText("Day 3 / 105")).toBeInTheDocument();
    expect(screen.getByText(/Python Data Structures/)).toBeInTheDocument();
    expect(screen.getByText("Collections, Files & Errors")).toBeInTheDocument();
  });

  it("shows confidence badge text", () => {
    render(
      <CurriculumMatchPanel
        proposal={makeProposal({ matchConfidence: "EXACT" })}
        selectedDay={3}
        onDayChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Exact match")).toBeInTheDocument();
  });

  it("shows Explicit reference when explicitDayMatch is true", () => {
    render(
      <CurriculumMatchPanel
        proposal={makeProposal({ explicitDayMatch: true })}
        selectedDay={3}
        onDayChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Explicit reference")).toBeInTheDocument();
  });

  it("shows Similarity match when explicitDayMatch is false and confidence is known", () => {
    render(
      <CurriculumMatchPanel
        proposal={makeProposal({ explicitDayMatch: false, matchConfidence: "HIGH" })}
        selectedDay={3}
        onDayChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Similarity match")).toBeInTheDocument();
  });

  it("shows — for UNKNOWN confidence", () => {
    render(
      <CurriculumMatchPanel
        proposal={makeProposal({ matchConfidence: "UNKNOWN" })}
        selectedDay={0}
        onDayChange={vi.fn()}
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows rationale when present", () => {
    render(
      <CurriculumMatchPanel proposal={makeProposal()} selectedDay={3} onDayChange={vi.fn()} />,
    );
    expect(screen.getByText(/Topic 'Collections' strongly matches day 3/)).toBeInTheDocument();
  });

  it("hides rationale when empty", () => {
    const { container } = render(
      <CurriculumMatchPanel
        proposal={makeProposal({ rationale: [] })}
        selectedDay={3}
        onDayChange={vi.fn()}
      />,
    );
    expect(container.querySelector("ul")).not.toBeInTheDocument();
  });

  it("shows day select dropdown", () => {
    render(
      <CurriculumMatchPanel proposal={makeProposal()} selectedDay={3} onDayChange={vi.fn()} />,
    );
    expect(screen.getByLabelText(/Curriculum Day/)).toBeInTheDocument();
  });

  it("calls onDayChange when day is selected", () => {
    const onDayChange = vi.fn();
    render(
      <CurriculumMatchPanel proposal={makeProposal()} selectedDay={3} onDayChange={onDayChange} />,
    );
    const select = screen.getByLabelText(/Curriculum Day/);
    fireEvent.change(select, { target: { value: "4" } });
    expect(onDayChange).toHaveBeenCalledWith(4);
  });

  it("shows suggested candidates in optgroup", () => {
    render(
      <CurriculumMatchPanel proposal={makeProposal()} selectedDay={3} onDayChange={vi.fn()} />,
    );
    expect(screen.getByText("Day 3 — Collections")).toBeInTheDocument();
    expect(screen.getByText("Day 4 — Web APIs")).toBeInTheDocument();
  });

  it("shows note when confidence is LOW", () => {
    render(
      <CurriculumMatchPanel
        proposal={makeProposal({ matchConfidence: "LOW" })}
        selectedDay={0}
        onDayChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("note")).toBeInTheDocument();
    expect(screen.getByText(/Could not confidently determine/)).toBeInTheDocument();
  });

  it("shows note when curriculumDay is 0", () => {
    render(
      <CurriculumMatchPanel
        proposal={makeProposal({ curriculumDay: 0 })}
        selectedDay={0}
        onDayChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("note")).toBeInTheDocument();
  });

  it("shows the manual selection hint", () => {
    render(
      <CurriculumMatchPanel proposal={makeProposal()} selectedDay={3} onDayChange={vi.fn()} />,
    );
    expect(screen.getByText("The matcher may be wrong — always confirm the day.")).toBeInTheDocument();
  });
});
