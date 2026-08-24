import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildJournalFromCourseMaterial,
  collectLearningStatements,
} from "./journal-builder";
import type { ExtractedPdfDocument } from "@/types/course-material";
import type { PageStructure } from "./extraction";
import type { CurriculumMatchResult } from "@/types/course-material";

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeDoc(pageTexts: string[]): { doc: ExtractedPdfDocument; structures: PageStructure[] } {
  const doc: ExtractedPdfDocument = {
    fileName: "python-course.pdf",
    pageCount: pageTexts.length,
    pages: pageTexts.map((text, i) => ({ pageNumber: i + 1, text })),
  };
  const structures: PageStructure[] = doc.pages.map((p) => ({
    pageNumber: p.pageNumber,
    headings: p.text.split("\n").filter((l) => l.length > 0 && l.length < 80),
    codeLines: p.text.includes("def ") ? ["def add(a, b):"] : [],
    text: p.text,
  }));
  return { doc, structures };
}

const match: CurriculumMatchResult = {
  dayNumber: 3,
  confidence: "EXACT",
  topic: "Collections, Files & Errors",
  moduleNumber: 2,
  moduleTitle: "Python Data Structures",
  explicitDayNumber: 3,
  explicitModuleNumber: 2,
  candidates: [
    { dayNumber: 3, topic: "Collections, Files & Errors", moduleNumber: 2, moduleTitle: "", score: 0.5 },
  ],
  rationale: ["Document explicitly references Day 3."],
};

// ─── collectLearningStatements ──────────────────────────────────────────────

describe("collectLearningStatements", () => {
  it("extracts only sentences with course-content verbs", () => {
    const { doc } = makeDoc([
      "This module covers dictionaries and sets in depth.",
      "I stayed up all night struggling with comprehensions.",
      "The course explains how modules organize code.",
    ]);

    const statements = collectLearningStatements(doc);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.sentence).toContain("covers dictionaries");
    expect(statements[0]!.pageNumber).toBe(1);
    expect(statements.some((s) => s.sentence.includes("stayed up"))).toBe(false);
  });

  it("preserves source page numbers across pages", () => {
    const { doc } = makeDoc([
      "Chapter one introduces basic collections.",
      "Later material describes file handling with context managers.",
    ]);

    const statements = collectLearningStatements(doc);
    expect(statements.map((s) => s.pageNumber)).toEqual([1, 2]);
  });
});

// ─── buildJournalFromCourseMaterial ─────────────────────────────────────────

describe("buildJournalFromCourseMaterial", () => {
  const days = [
    { id: "d3", day_number: 3, module_id: "m2", week_number: null, topic: "Collections, Files & Errors", content: "", subtopics: [], project_information: null, assessment_information: null, created_at: "", updated_at: "" },
    { id: "d4", day_number: 4, module_id: "m2", week_number: null, topic: "Web APIs & HTTP", content: "", subtopics: [], project_information: null, assessment_information: null, created_at: "", updated_at: "" },
  ];
  const modules = [
    { id: "m2", module_number: 2, title: "Python Data Structures", description: null, weeks: null, days: null, hours: null, start_day: 11, end_day: 25, created_at: "", updated_at: "" },
  ];
  const source = { days, modules };

  it("populates whatILearned from explicit course statements with evidence", () => {
    const { doc, structures } = makeDoc([
      "This module covers dictionaries, sets, comprehensions and modules.",
    ]);
    const proposal = buildJournalFromCourseMaterial({ doc, structures, match, source, totalDays: 105 });

    expect(proposal.journal.whatILearned).toContain("dictionaries");
    const learnedEvidence = proposal.evidence.find((e) => e.field === "whatILearned")!;
    expect(learnedEvidence.sourceType).toBe("pdf");
    expect(learnedEvidence.confidence).toBe("SUPPORTED_BY_PDF");
    expect(learnedEvidence.pageNumbers).toEqual([1]);
  });

  it("NEVER fabricates personal experience — practice/build/challenge stay null", () => {
    // The PDF explicitly mentions exercises AND a project — still not personal experience.
    const { doc, structures } = makeDoc([
      "This module covers dictionaries.",
      "Exercise: try building a small dictionary utility yourself.",
      "Example project: build a price tracker application.",
    ]);
    const proposal = buildJournalFromCourseMaterial({ doc, structures, match, source, totalDays: 105 });

    expect(proposal.journal.whatIPracticed).toBeNull();
    expect(proposal.journal.whatIBuilt).toBeNull();
    expect(proposal.journal.challenge).toBeNull();
    expect(proposal.journal.howISolvedIt).toBeNull();

    expect(proposal.missingFields).toEqual(
      expect.arrayContaining(["whatIPracticed", "whatIBuilt", "challenge", "howISolvedIt"]),
    );
    // Warnings must explain why.
    expect(proposal.warnings.some((w) => w.includes("does not confirm"))).toBe(true);
    expect(proposal.warnings.some((w) => w.includes("project"))).toBe(true);
  });

  it("never invents a confidence level and flags it as required input", () => {
    const { doc, structures } = makeDoc(["The course covers sets."]);
    const proposal = buildJournalFromCourseMaterial({ doc, structures, match, source, totalDays: 105 });

    expect(proposal.journal.confidenceLevel).toBeNull();
    expect(proposal.missingFields).toContain("confidenceLevel");
  });

  it("marks tomorrowFocus as a curriculum-derived suggestion when supported", () => {
    const { doc, structures } = makeDoc(["The course covers dictionaries."]);
    const proposal = buildJournalFromCourseMaterial({ doc, structures, match, source, totalDays: 105 });

    expect(proposal.journal.tomorrowFocus).toContain("(Suggested)");
    expect(proposal.journal.tomorrowFocus).toContain("Day 4");
    const focusEvidence = proposal.evidence.find((e) => e.field === "tomorrowFocus")!;
    expect(focusEvidence.sourceType).toBe("curriculum");
    expect(focusEvidence.confidence).toBe("INFERRED_FROM_STRUCTURE");
  });

  it("records the uploaded PDF itself as the resource used", () => {
    const { doc, structures } = makeDoc(["The course covers sets."]);
    const proposal = buildJournalFromCourseMaterial({ doc, structures, match, source, totalDays: 105 });

    expect(proposal.journal.resourcesUsed).toContain("python-course.pdf");
    const resourceEvidence = proposal.evidence.find((e) => e.field === "resourcesUsed")!;
    expect(resourceEvidence.sourceType).toBe("user");
    expect(resourceEvidence.confidence).toBe("USER_CONFIRMED");
  });

  it("references code files only when they actually appear in the PDF", () => {
    const { doc, structures } = makeDoc([
      "The course covers functions.\nThe example file price_utils.py demonstrates helpers.",
    ]);
    const proposal = buildJournalFromCourseMaterial({ doc, structures, match, source, totalDays: 105 });

    expect(proposal.journal.codeReference).toContain("price_utils.py");
    const codeEvidence = proposal.evidence.find((e) => e.field === "codeReference")!;
    expect(codeEvidence.sourceType).toBe("pdf");

    // And absent code yields null.
    const plain = makeDoc(["The course covers functions."]);
    const proposal2 = buildJournalFromCourseMaterial({
      doc: plain.doc, structures: plain.structures, match, source, totalDays: 105,
    });
    expect(proposal2.journal.codeReference).toBeNull();
  });

  it("carries low-confidence warnings through to the proposal", () => {
    const { doc, structures } = makeDoc(["The course covers sets."]);
    const weakMatch: CurriculumMatchResult = { ...match, confidence: "MEDIUM" };
    const proposal = buildJournalFromCourseMaterial({
      doc, structures, match: weakMatch, source, totalDays: 105,
    });

    expect(proposal.warnings.some((w) => w.includes("verify the selected day"))).toBe(true);
  });

  it("keeps every field traceable — 13 evidence entries", () => {
    const { doc, structures } = makeDoc(["The course covers sets."]);
    const proposal = buildJournalFromCourseMaterial({ doc, structures, match, source, totalDays: 105 });

    expect(proposal.evidence).toHaveLength(13);
    expect(new Set(proposal.evidence.map((e) => e.field)).size).toBe(13);
  });
});
