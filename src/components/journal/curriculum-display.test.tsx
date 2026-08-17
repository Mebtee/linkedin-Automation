import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { CurriculumDisplay } from "./curriculum-display";

const mockCurriculumDay = {
  id: "1",
  day_number: 18,
  module_id: "mod-2",
  week_number: 3,
  topic: "React Hooks Deep Dive",
  content: "Learn useState, useEffect, custom hooks.",
  subtopics: ["useState", "useEffect", "Custom Hooks"],
  project_information: "Build a habit tracker with hooks",
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

describe("CurriculumDisplay", () => {
  it("renders curriculum topic and content", () => {
    render(
      <CurriculumDisplay
        dayNumber={18}
        curriculumDay={mockCurriculumDay}
        currentModule={mockModule}
      />,
    );

    expect(screen.getByText("React Hooks Deep Dive")).toBeDefined();
    expect(
      screen.getByText("Learn useState, useEffect, custom hooks."),
    ).toBeDefined();
  });

  it("renders module badge", () => {
    render(
      <CurriculumDisplay
        dayNumber={18}
        curriculumDay={mockCurriculumDay}
        currentModule={mockModule}
      />,
    );

    expect(screen.getByText("Module 2")).toBeDefined();
  });

  it("renders subtopics", () => {
    render(
      <CurriculumDisplay
        dayNumber={18}
        curriculumDay={mockCurriculumDay}
        currentModule={mockModule}
      />,
    );

    expect(screen.getByText("useState")).toBeDefined();
    expect(screen.getByText("useEffect")).toBeDefined();
    expect(screen.getByText("Custom Hooks")).toBeDefined();
  });

  it("renders project information", () => {
    render(
      <CurriculumDisplay
        dayNumber={18}
        curriculumDay={mockCurriculumDay}
        currentModule={mockModule}
      />,
    );

    expect(
      screen.getByText("Build a habit tracker with hooks"),
    ).toBeDefined();
  });

  it("shows unavailable message when curriculum day is null", () => {
    render(
      <CurriculumDisplay
        dayNumber={99}
        curriculumDay={null}
        currentModule={null}
      />,
    );

    expect(
      screen.getByText(
        "Curriculum data for Day 99 is not available yet.",
      ),
    ).toBeDefined();
  });

  it("renders day number badge", () => {
    render(
      <CurriculumDisplay
        dayNumber={18}
        curriculumDay={mockCurriculumDay}
        currentModule={mockModule}
      />,
    );

    expect(screen.getByText("Day 18")).toBeDefined();
  });
});
