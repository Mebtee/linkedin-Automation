import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { detectDaySections } from "./multi-day";
import type { ExtractedPdfDocument } from "@/types/course-material";
import type { PageStructure } from "./extraction";
import type { CurriculumDayRow, ModuleRow } from "@/services/curriculum/dayProgress";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const modules: ModuleRow[] = [
  {
    id: "m1", module_number: 1, title: "Foundations",
    description: null, weeks: 2, days: 10, hours: null, start_day: 1, end_day: 10,
    created_at: "", updated_at: "",
  },
  {
    id: "m2", module_number: 2, title: "Python Data Structures",
    description: null, weeks: 3, days: 15, hours: null, start_day: 11, end_day: 25,
    created_at: "", updated_at: "",
  },
];

function day(n: number, topic: string, moduleId: string): CurriculumDayRow {
  return {
    id: `d${n}`, day_number: n, module_id: moduleId, week_number: null,
    topic, content: `${topic}.`, subtopics: [],
    project_information: null, assessment_information: null,
    created_at: "", updated_at: "",
  };
}

const days = [
  day(1, "Git & Version Control", "m1"),
  day(2, "Terminal & Shell Basics", "m1"),
  day(3, "Collections, Files & Errors", "m2"),
  day(4, "Web APIs & HTTP", "m2"),
  day(5, "HTML Basics", "m2"),
];

const source = { days, modules };

function makeStructures(texts: string[]): PageStructure[] {
  return texts.map((text, i) => ({
    pageNumber: i + 1,
    headings: text.split("\n").filter((l) => l.trim().length > 0 && l.length < 80),
    codeLines: [],
    text,
  }));
}

function makeDoc(texts: string[]): ExtractedPdfDocument {
  return {
    fileName: "multi-day.pdf",
    pageCount: texts.length,
    pages: texts.map((text, i) => ({ pageNumber: i + 1, text })),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("detectDaySections", () => {
  it("returns empty array for single-day PDF with no Day N headers", () => {
    const doc = makeDoc(["This module covers dictionaries and sets in depth."]);
    const structures = makeStructures(["This module covers dictionaries and sets in depth."]);
    const sections = detectDaySections(doc, structures, source, 105);
    expect(sections).toEqual([]);
  });

  it("detects multi-day sections with explicit Day N headers", () => {
    const texts = [
      "Day 1 lesson\nGit basics and version control.",
      "Day 2 lesson\nTerminal navigation and shell commands.",
      "Day 3 lesson\nDictionaries, sets, and comprehensions.",
    ];
    const doc = makeDoc(texts);
    const structures = makeStructures(texts);
    const sections = detectDaySections(doc, structures, source, 105);

    expect(sections).toHaveLength(3);
    expect(sections[0]).toMatchObject({ dayNumber: 1, startPage: 1, endPage: 1, confidence: "EXACT" });
    expect(sections[1]).toMatchObject({ dayNumber: 2, startPage: 2, endPage: 2, confidence: "EXACT" });
    expect(sections[2]).toMatchObject({ dayNumber: 3, startPage: 3, endPage: 3, confidence: "EXACT" });
  });

  it("extends last section to end of document", () => {
    const texts = [
      "Day 3 content\nDictionaries and sets.",
      "More Day 3 content\nAdvanced topics.",
      "Day 4 content\nWeb APIs.",
      "Extra content without day header.",
    ];
    const doc = makeDoc(texts);
    const structures = makeStructures(texts);
    const sections = detectDaySections(doc, structures, source, 105);

    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({ dayNumber: 3, startPage: 1, endPage: 2 });
    expect(sections[1]).toMatchObject({ dayNumber: 4, startPage: 3, endPage: 4 });
  });

  it("ignores out-of-range day numbers", () => {
    const texts = [
      "Day 3 covers collections.",
      "Day 999 is outside range.",
    ];
    const doc = makeDoc(texts);
    const structures = makeStructures(texts);
    const sections = detectDaySections(doc, structures, source, 105);

    // Only Day 3 is in range; need at least 2 unique days for multi-day
    expect(sections).toEqual([]);
  });

  it("returns empty when only one unique day is found", () => {
    const texts = [
      "Day 3 covers collections.",
      "More Day 3 content here.",
      "Even more Day 3 material.",
    ];
    const doc = makeDoc(texts);
    const structures = makeStructures(texts);
    const sections = detectDaySections(doc, structures, source, 105);

    expect(sections).toEqual([]);
  });

  it("returns empty when no Day N patterns exist", () => {
    const texts = [
      "Module 2: Python Data Structures",
      "This chapter covers dictionaries and sets.",
    ];
    const doc = makeDoc(texts);
    const structures = makeStructures(texts);
    const sections = detectDaySections(doc, structures, source, 105);

    expect(sections).toEqual([]);
  });

  it("detects Day patterns in headings (case insensitive)", () => {
    const texts = [
      "day 1 Introduction to Git",
      "Day 2 Terminal Basics",
    ];
    const doc = makeDoc(texts);
    const structures = makeStructures(texts);
    const sections = detectDaySections(doc, structures, source, 105);

    expect(sections).toHaveLength(2);
  });
});
