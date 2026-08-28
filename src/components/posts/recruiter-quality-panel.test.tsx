import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  RecruiterQualityPanel,
  recommendationLabel,
  recommendationStyle,
} from "./recruiter-quality-panel";
import type { RecruiterQualityReport } from "@/types/recruiter-quality";

const strongReport: RecruiterQualityReport = {
  dimensions: {
    recruiterRelevance: 20,
    evidenceStrength: 20,
    technicalDepth: 12,
    practicalExperience: 15,
    problemSolving: 8,
    clarity: 9,
    authenticity: 4,
    learningGrowth: 5,
  },
  recommendation: "strong",
  score: 93,
  strengths: ["Clear implementation narrative", "Confirmed evidence throughout"],
  improvements: [],
  warnings: [],
  evaluatedAt: "2026-08-28T00:00:00.000Z",
};

describe("RecruiterQualityPanel", () => {
  it("renders the empty state when no report exists", () => {
    render(<RecruiterQualityPanel report={null} />);
    expect(screen.getByText("Recruiter Quality")).toBeDefined();
    expect(screen.getByText(/not linked to a content opportunity/i)).toBeDefined();
  });

  it("renders score, recommendation badge, and dimension rows", () => {
    render(<RecruiterQualityPanel report={strongReport} />);
    expect(screen.getByText("93")).toBeDefined();
    expect(screen.getByText("Strong")).toBeDefined();
    expect(screen.getByText("Recruiter relevance")).toBeDefined();
    expect(screen.getByText("Evidence strength")).toBeDefined();
    expect(screen.getByText("Learning & growth")).toBeDefined();
  });

  it("renders strengths, improvements, and warnings lists", () => {
    render(
      <RecruiterQualityPanel
        report={{
          ...strongReport,
          improvements: ["Add an explicit outcome statement"],
          warnings: ["Critical: Unsupported claim of personal build."],
        }}
      />,
    );
    expect(screen.getByLabelText("Strengths")).toBeDefined();
    expect(screen.getByText("Add an explicit outcome statement")).toBeDefined();
    expect(screen.getByLabelText("Warnings")).toBeDefined();
    expect(
      screen.getByText("Critical: Unsupported claim of personal build."),
    ).toBeDefined();
  });

  it("does not render lists that are empty", () => {
    render(<RecruiterQualityPanel report={strongReport} />);
    expect(screen.queryByLabelText("Suggested improvements")).toBeNull();
    expect(screen.queryByLabelText("Warnings")).toBeNull();
  });

  it("renders the evaluated-at timestamp when present", () => {
    render(<RecruiterQualityPanel report={strongReport} />);
    expect(screen.getByText(/Evaluated/)).toBeDefined();
  });
});

describe("recommendationLabel", () => {
  it("maps each recommendation to a display label", () => {
    expect(recommendationLabel("strong")).toBe("Strong");
    expect(recommendationLabel("ready")).toBe("Ready");
    expect(recommendationLabel("needs_review")).toBe("Needs review");
    expect(recommendationLabel("do_not_publish")).toBe("Do not publish");
  });
});

describe("recommendationStyle", () => {
  it("returns a tailwind class string for each recommendation", () => {
    expect(recommendationStyle("do_not_publish")).toContain("bg-red-100");
    expect(recommendationStyle("needs_review")).toContain("bg-amber-100");
  });
});