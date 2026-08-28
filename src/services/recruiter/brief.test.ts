import { describe, it, expect } from "vitest";

import { buildRecruiterContentBrief } from "./brief";
import type { RecruiterPostGenerationContext } from "@/types/content-opportunity";
import type { JournalContext } from "@/types/ai";

const journalContext: JournalContext = {
  whatILearned: "I learned how git staging works.",
  whatIPracticed: "I practiced committing with clear messages.",
  whatIBuilt: "I built the Git Journal Tracker.",
  challenge: "A merge conflict confused me mid-project.",
  howISolvedIt: "I resolved the conflict keeping both changes.",
  keyTakeaway: "Small, frequent commits matter.",
  tomorrowFocus: "Learn branches.",
  projectName: "Git Journal Tracker",
  projectDescription: "A CLI that tracks my learning journal in Git history.",
  codeReference: null,
  resourcesUsed: "FreeCodeCamp Git tutorial",
  confidenceLevel: 3,
  additionalNotes: null,
};

function makeContext(
  overrides: Partial<RecruiterPostGenerationContext> = {},
): RecruiterPostGenerationContext {
  return {
    opportunityId: "op-1",
    postType: "PROJECT_SHOWCASE",
    contentGoal: "SHOW_PROJECTS",
    title: "Building Git Journal Tracker",
    summary: "A small CLI that tracks my learning journal in Git history.",
    recruiterScore: 88,
    recruiterScoreBreakdown: null,
    selectionReason: "Strong implementation evidence.",
    evidence: [
      { field: "whatIBuilt", value: "I built the Git Journal Tracker.", confidence: "USER_CONFIRMED", pageNumbers: [3, 4] },
      { field: "challenge", value: "A merge conflict confused me.", confidence: "USER_CONFIRMED", pageNumbers: [] },
      { field: "howISolvedIt", value: "I resolved the conflict.", confidence: "USER_CONFIRMED", pageNumbers: [] },
    ],
    evidenceStrength: "USER_CONFIRMED",
    personalExperience: true,
    journal: journalContext,
    dayNumber: 1,
    topic: "Git and Terminal Basics",
    format: "project",
    ...overrides,
  };
}

describe("buildRecruiterContentBrief", () => {
  it("maps the content goal to a human-readable primary goal", () => {
    const brief = buildRecruiterContentBrief(makeContext());
    expect(brief.primaryGoal).toBe("Show projects");
  });

  it("names the strongest confirmed evidence and signals confirmed engineering work", () => {
    const brief = buildRecruiterContentBrief(makeContext());
    expect(brief.strongestEvidence).toContain("Git Journal Tracker");
    expect(brief.recruiterSignal).toContain("Confirmed personal engineering work");
  });

  it("falls back to learning-only language when no evidence is confirmed", () => {
    const brief = buildRecruiterContentBrief(
      makeContext({
        evidenceStrength: "MISSING",
        evidence: [],
        personalExperience: false,
        postType: "TECHNICAL_LESSON",
      }),
    );
    expect(brief.strongestEvidence).toBe("No confirmed evidence — learning content only.");
    expect(brief.recruiterSignal).toContain("Learning content only");
  });

  it("carries practical, problem-solving, and growth focus from confirmed evidence only", () => {
    const brief = buildRecruiterContentBrief(makeContext());
    expect(brief.practicalFocus).toContain("Git Journal Tracker");
    expect(brief.problemSolvingFocus).toContain("merge conflict");
    expect(brief.problemSolvingFocus).toContain("resolved");
    expect(brief.growthFocus).toBeNull();
  });

  it("never invents evidence not present in the context", () => {
    const brief = buildRecruiterContentBrief(
      makeContext({ evidence: [], evidenceStrength: "MISSING", personalExperience: false }),
    );
    expect(brief.practicalFocus).toBeNull();
    expect(brief.problemSolvingFocus).toBeNull();
    expect(brief.growthFocus).toBeNull();
  });

  it("forbids production claims on non-personal post types and always forbids mastery", () => {
    const brief = buildRecruiterContentBrief(
      makeContext({ personalExperience: false, postType: "TECHNICAL_LESSON", evidenceStrength: "SUPPORTED_BY_PDF" }),
    );
    expect(brief.forbiddenClaims.length).toBeGreaterThan(0);
    expect(brief.forbiddenClaims.some((c) => c.includes("production"))).toBe(true);
    expect(brief.forbiddenClaims.some((c) => /mastery/.test(c))).toBe(true);
  });

  it("surfaces a deterministic technical focus derived from topic and post-type tags", () => {
    const brief = buildRecruiterContentBrief(makeContext({ postType: "ENGINEERING_DECISION" }));
    expect(brief.technicalFocus).toContain("Git and Terminal Basics");
    expect(brief.technicalFocus).toContain("#FullStackDevelopment");
  });
});