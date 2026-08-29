import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { JournalForm } from "./journal-form";

vi.mock("server-only", () => ({}));

// Mock the server actions
vi.mock("@/app/actions/journal", () => ({
  saveJournal: vi.fn(),
  submitJournal: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockEntry = {
  id: "entry-1",
  profile_id: "user-1",
  day_number: 18,
  status: "draft" as const,
  what_i_learned: "React hooks",
  what_i_practiced: null,
  what_i_built: null,
  challenge: null,
  how_i_solved_it: null,
  key_takeaway: null,
  tomorrow_focus: null,
  project_name: null,
  project_description: null,
  code_reference: null,
  resources_used: null,
  confidence_level: null,
  additional_notes: null,
  created_at: "2026-08-17T10:00:00Z",
  updated_at: "2026-08-17T10:00:00Z",
};

const mockCurriculumDay = {
  id: "1",
  day_number: 18,
  module_id: "mod-2",
  week_number: 3,
  topic: "React Hooks Deep Dive",
  content: "Learn useState, useEffect, custom hooks.",
  subtopics: ["useState", "useEffect"],
  project_information: null,
  assessment_information: null,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};

const mockModule = {
  id: "mod-2",
  module_number: 2,
  title: "Frontend Development",
  description: null,
  weeks: 3,
  days: 18,
  hours: 54,
  start_day: 19,
  end_day: 36,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};

describe("JournalForm persistence", () => {
  it("populates form fields from existing entry", () => {
    render(
      <JournalForm
        entry={mockEntry}
        curriculumDay={mockCurriculumDay}
        currentModule={mockModule}
        dayNumber={18}
        totalDays={105}
      />,
    );

    const learnedField = screen.getByLabelText("What did I learn?");
    expect((learnedField as HTMLTextAreaElement).value).toBe("React hooks");
  });

  it("shows empty form when no entry exists", () => {
    render(
      <JournalForm
        entry={null}
        curriculumDay={mockCurriculumDay}
        currentModule={mockModule}
        dayNumber={18}
        totalDays={105}
      />,
    );

    const learnedField = screen.getByLabelText("What did I learn?");
    expect((learnedField as HTMLTextAreaElement).value).toBe("");
  });

  it("shows draft status for draft entries", () => {
    render(
      <JournalForm
        entry={mockEntry}
        curriculumDay={mockCurriculumDay}
        currentModule={mockModule}
        dayNumber={18}
        totalDays={105}
      />,
    );

    expect(screen.getByText("Draft")).toBeDefined();
  });

  it("shows submitted status for submitted entries", () => {
    render(
      <JournalForm
        entry={{ ...mockEntry, status: "submitted" }}
        curriculumDay={mockCurriculumDay}
        currentModule={mockModule}
        dayNumber={18}
        totalDays={105}
      />,
    );

    expect(screen.getByText("Submitted")).toBeDefined();
  });

  it("makes form read-only for submitted entries", () => {
    render(
      <JournalForm
        entry={{ ...mockEntry, status: "submitted" }}
        curriculumDay={mockCurriculumDay}
        currentModule={mockModule}
        dayNumber={18}
        totalDays={105}
      />,
    );

    const learnedField = screen.getByLabelText("What did I learn?");
    expect((learnedField as HTMLTextAreaElement).disabled).toBe(true);
  });

  it("hides save and submit buttons for submitted entries", () => {
    render(
      <JournalForm
        entry={{ ...mockEntry, status: "submitted" }}
        curriculumDay={mockCurriculumDay}
        currentModule={mockModule}
        dayNumber={18}
        totalDays={105}
      />,
    );

    expect(screen.queryByText("Save Draft")).toBeNull();
    expect(screen.queryByText("Submit Journal")).toBeNull();
  });

  it("shows save and submit buttons for draft entries", () => {
    render(
      <JournalForm
        entry={mockEntry}
        curriculumDay={mockCurriculumDay}
        currentModule={mockModule}
        dayNumber={18}
        totalDays={105}
      />,
    );

    expect(screen.getByText("Save Draft")).toBeDefined();
    expect(screen.getByText("Submit Journal")).toBeDefined();
  });

  it("disables submit button when no content", () => {
    render(
      <JournalForm
        entry={{ ...mockEntry, what_i_learned: null }}
        curriculumDay={mockCurriculumDay}
        currentModule={mockModule}
        dayNumber={18}
        totalDays={105}
      />,
    );

    const submitButton = screen.getByText("Submit Journal");
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables submit button when content exists", () => {
    render(
      <JournalForm
        entry={mockEntry}
        curriculumDay={mockCurriculumDay}
        currentModule={mockModule}
        dayNumber={18}
        totalDays={105}
      />,
    );

    const submitButton = screen.getByText("Submit Journal");
    expect((submitButton as HTMLButtonElement).disabled).toBe(false);
  });

  it("displays day number correctly", () => {
    render(
      <JournalForm
        entry={mockEntry}
        curriculumDay={mockCurriculumDay}
        currentModule={mockModule}
        dayNumber={18}
        totalDays={105}
      />,
    );

    expect(screen.getAllByText("Day 18 / 105").length).toBeGreaterThanOrEqual(1);
  });

  it("displays curriculum topic", () => {
    render(
      <JournalForm
        entry={mockEntry}
        curriculumDay={mockCurriculumDay}
        currentModule={mockModule}
        dayNumber={18}
        totalDays={105}
      />,
    );

    expect(screen.getByText("React Hooks Deep Dive")).toBeDefined();
  });
});
