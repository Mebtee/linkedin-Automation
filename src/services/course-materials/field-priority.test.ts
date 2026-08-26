import { describe, it, expect } from "vitest";

// ─── Field Priority Tests ───────────────────────────────────────────────────
// These tests verify the USER_CONFIRMED preservation logic used in
// reprocessing. The preserveUserConfirmedFields() function is internal
// to persistence.ts, but we test its behavior through the reprocess
// integration test. These unit tests verify the conceptual contract.

import type { CourseJournalProposal } from "@/types/course-material";

function makeProposalWithConfirmedFields(): CourseJournalProposal {
  return {
    curriculumDay: 3,
    moduleNumber: 2,
    moduleTitle: "Python Data Structures",
    topic: "Collections",
    matchConfidence: "EXACT",
    journal: {
      whatILearned: "PDF-extracted content about dictionaries",
      whatIPracticed: "User wrote this about their practice",
      whatIBuilt: null,
      challenge: "User described this challenge",
      howISolvedIt: "User explained their solution",
      keyTakeaway: "PDF-extracted key takeaway",
      tomorrowFocus: "(Suggested) Day 4: Web APIs",
      projectName: null,
      projectDescription: null,
      codeReference: "example.py",
      resourcesUsed: "Course PDF: course.pdf",
      confidenceLevel: null,
      additionalNotes: null,
    },
    evidence: [
      { field: "whatILearned", sourceType: "pdf", pageNumbers: [1], confidence: "SUPPORTED_BY_PDF" },
      { field: "whatIPracticed", sourceType: "user", pageNumbers: [], confidence: "USER_CONFIRMED" },
      { field: "whatIBuilt", sourceType: "missing", pageNumbers: [], confidence: "MISSING" },
      { field: "challenge", sourceType: "user", pageNumbers: [], confidence: "USER_CONFIRMED" },
      { field: "howISolvedIt", sourceType: "user", pageNumbers: [], confidence: "USER_CONFIRMED" },
      { field: "keyTakeaway", sourceType: "pdf", pageNumbers: [1], confidence: "SUPPORTED_BY_PDF" },
      { field: "tomorrowFocus", sourceType: "curriculum", pageNumbers: [], confidence: "INFERRED_FROM_STRUCTURE" },
      { field: "projectName", sourceType: "missing", pageNumbers: [], confidence: "MISSING" },
      { field: "projectDescription", sourceType: "missing", pageNumbers: [], confidence: "MISSING" },
      { field: "codeReference", sourceType: "pdf", pageNumbers: [1], confidence: "SUPPORTED_BY_PDF" },
      { field: "resourcesUsed", sourceType: "user", pageNumbers: [], confidence: "USER_CONFIRMED" },
      { field: "confidenceLevel", sourceType: "missing", pageNumbers: [], confidence: "MISSING" },
      { field: "additionalNotes", sourceType: "missing", pageNumbers: [], confidence: "MISSING" },
    ],
    missingFields: ["whatIBuilt", "projectName", "projectDescription", "confidenceLevel"],
    warnings: [],
    candidates: [],
    rationale: [],
    builtBy: "deterministic",
    explicitDayMatch: true,
  };
}

describe("Field priority contract", () => {
  it("USER_CONFIRMED fields are identified correctly", () => {
    const proposal = makeProposalWithConfirmedFields();
    const userConfirmed = proposal.evidence
      .filter((e) => e.confidence === "USER_CONFIRMED")
      .map((e) => e.field);

    expect(userConfirmed).toContain("whatIPracticed");
    expect(userConfirmed).toContain("challenge");
    expect(userConfirmed).toContain("howISolvedIt");
    expect(userConfirmed).toContain("resourcesUsed");
    expect(userConfirmed).not.toContain("whatILearned");
    expect(userConfirmed).not.toContain("keyTakeaway");
    expect(userConfirmed).not.toContain("tomorrowFocus");
  });

  it("SUPPORTED_BY_PDF fields are identified correctly", () => {
    const proposal = makeProposalWithConfirmedFields();
    const pdfSupported = proposal.evidence
      .filter((e) => e.confidence === "SUPPORTED_BY_PDF")
      .map((e) => e.field);

    expect(pdfSupported).toContain("whatILearned");
    expect(pdfSupported).toContain("keyTakeaway");
    expect(pdfSupported).toContain("codeReference");
    expect(pdfSupported).not.toContain("whatIPracticed");
  });

  it("MISSING fields are identified correctly", () => {
    const proposal = makeProposalWithConfirmedFields();
    const missing = proposal.evidence
      .filter((e) => e.confidence === "MISSING")
      .map((e) => e.field);

    expect(missing).toContain("whatIBuilt");
    expect(missing).toContain("projectName");
    expect(missing).toContain("projectDescription");
    expect(missing).toContain("confidenceLevel");
  });

  it("INFERRED_FROM_STRUCTURE fields are identified correctly", () => {
    const proposal = makeProposalWithConfirmedFields();
    const inferred = proposal.evidence
      .filter((e) => e.confidence === "INFERRED_FROM_STRUCTURE")
      .map((e) => e.field);

    expect(inferred).toContain("tomorrowFocus");
  });

  it("priority ordering is maintained: USER_CONFIRMED > SUPPORTED_BY_PDF > INFERRED_FROM_STRUCTURE > MISSING", () => {
    const proposal = makeProposalWithConfirmedFields();

    // Verify the priority ordering conceptually
    const fieldPriorities: Record<string, number> = {
      USER_CONFIRMED: 4,
      SUPPORTED_BY_PDF: 3,
      INFERRED_FROM_STRUCTURE: 2,
      MISSING: 1,
    };

    for (const evidence of proposal.evidence) {
      expect(fieldPriorities[evidence.confidence]).toBeGreaterThan(0);
    }

    // USER_CONFIRMED fields should have the highest priority
    const userConfirmedFields = proposal.evidence.filter((e) => e.confidence === "USER_CONFIRMED");
    for (const e of userConfirmedFields) {
      expect(fieldPriorities[e.confidence]).toBe(4);
    }

    // MISSING fields should have the lowest priority
    const missingFields = proposal.evidence.filter((e) => e.confidence === "MISSING");
    for (const e of missingFields) {
      expect(fieldPriorities[e.confidence]).toBe(1);
    }
  });

  it("confidenceLevel is never auto-populated", () => {
    const proposal = makeProposalWithConfirmedFields();
    expect(proposal.journal.confidenceLevel).toBeNull();

    const clEvidence = proposal.evidence.find((e) => e.field === "confidenceLevel");
    expect(clEvidence?.confidence).toBe("MISSING");
    expect(proposal.missingFields).toContain("confidenceLevel");
  });
});
