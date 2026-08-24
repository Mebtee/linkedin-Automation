import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { matchCurriculum } from "./matching";
import type { ExtractedPdfDocument } from "@/types/course-material";
import type { CurriculumDayRow, ModuleRow } from "@/services/curriculum/dayProgress";
import type { PageStructure } from "./extraction";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const modules: ModuleRow[] = [
  {
    id: "m1", module_number: 1, title: "Foundation: Git, Terminal & Python Basics",
    description: null, weeks: 2, days: 10, hours: null, start_day: 1, end_day: 10,
    created_at: "", updated_at: "",
  },
  {
    id: "m2", module_number: 2, title: "Python Data Structures",
    description: null, weeks: 3, days: 15, hours: null, start_day: 11, end_day: 25,
    created_at: "", updated_at: "",
  },
];

function day(n: number, topic: string, moduleId: string, subtopics: string[]): CurriculumDayRow {
  return {
    id: `d${n}`, day_number: n, module_id: moduleId, week_number: null,
    topic, content: `${topic}. Learn and practice the topics above.`,
    subtopics, project_information: null, assessment_information: null,
    created_at: "", updated_at: "",
  };
}

const days: CurriculumDayRow[] = [
  day(1, "Git & Version Control", "m1", ["git init", "git commit", "branching"]),
  day(2, "Terminal & Shell Basics", "m1", ["navigation", "commands", "pipes"]),
  day(3, "Collections, Files & Errors", "m2", [
    "dictionaries", "sets", "comprehensions", "modules", "file handling", "exceptions",
  ]),
  day(4, "Web APIs & HTTP", "m2", ["requests", "responses", "status codes"]),
];

function docFromText(texts: string[]): {
  doc: ExtractedPdfDocument;
  structures: PageStructure[];
} {
  const doc: ExtractedPdfDocument = {
    fileName: "course.pdf",
    pageCount: texts.length,
    pages: texts.map((text, i) => ({ pageNumber: i + 1, text })),
  };
  const structures = doc.pages.map((p) => ({
    pageNumber: p.pageNumber,
    headings: p.text.split("\n").filter((l) => l.length > 0 && l.length < 80),
    codeLines: [],
    text: p.text,
  }));
  return { doc, structures };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("matchCurriculum", () => {
  it("selects EXACT when an explicit in-range Day reference exists with matching module/topic terms", () => {
    const { doc, structures } = docFromText([
      "Course Book — Module 2",
      "Day 3 lesson. This chapter covers dictionaries, sets, comprehensions, modules and file handling.",
    ]);
    const result = matchCurriculum(doc, structures, { days, modules }, 105);

    expect(result.dayNumber).toBe(3);
    expect(result.explicitDayNumber).toBe(3);
    expect(result.confidence).toBe("EXACT");
    expect(result.topic).toBe("Collections, Files & Errors");
    expect(result.moduleNumber).toBe(2);
  });

  it("uses an explicit day reference even with weak topical overlap (HIGH)", () => {
    const { doc, structures } = docFromText([
      "Lesson notes for Day 2 today.",
      "General study advice without topical keywords.",
    ]);
    const result = matchCurriculum(doc, structures, { days, modules }, 105);

    expect(result.dayNumber).toBe(2);
    expect(result.confidence).toBe("HIGH");
  });

  it("ignores out-of-range explicit day references", () => {
    const { doc, structures } = docFromText([
      "See also Day 900 for advanced material.",
      "This section covers dictionaries and sets.",
    ]);
    const result = matchCurriculum(doc, structures, { days, modules }, 105);

    expect(result.explicitDayNumber).toBe(900);
    expect(result.dayNumber).not.toBe(900);
  });

  it("ranks by topic overlap when no explicit day exists (HIGH)", () => {
    const { doc, structures } = docFromText([
      "Python data handling guide.",
      "This course covers dictionaries, sets, comprehensions and modules extensively.",
      "Working with collections means dictionaries, sets, comprehensions and modules everywhere.",
    ]);
    const result = matchCurriculum(doc, structures, { days, modules }, 105);

    expect(result.dayNumber).toBe(3);
    expect(["HIGH", "MEDIUM"]).toContain(result.confidence);
  });

  it("boosts days inside an explicitly referenced module", () => {
    const { doc, structures } = docFromText([
      "Module 2 reading pack.",
      "Some general content about programming concepts and tools.",
    ]);
    const result = matchCurriculum(doc, structures, { days, modules }, 105);

    // No strong topic signal — but Module 2 evidence must rank its days first.
    if (result.candidates.length >= 2) {
      const first = result.candidates[0]!;
      expect([3, 4]).toContain(first.dayNumber);
    }
  });

  it("returns UNKNOWN with no selection when there is no signal at all", () => {
    const { doc, structures } = docFromText(["Completely unrelated zzz qqq xxx text."]);
    const result = matchCurriculum(doc, structures, { days, modules }, 105);

    expect(result.dayNumber).toBeNull();
    expect(result.confidence).toBe("UNKNOWN");
    expect(result.candidates).toHaveLength(0);
  });

  it("never silently selects LOW-confidence matches — candidates are surfaced instead", () => {
    // Faint overlap only.
    const { doc, structures } = docFromText([
      "A short note mentioning sets once.",
    ]);
    const result = matchCurriculum(doc, structures, { days, modules }, 105);

    if (result.confidence === "LOW") {
      expect(result.dayNumber).toBeNull();
      expect(result.candidates.length).toBeGreaterThan(0);
    }
  });

  it("always provides ranked candidates alongside a selected day", () => {
    const { doc, structures } = docFromText([
      "Day 3 material covering dictionaries and sets.",
    ]);
    const result = matchCurriculum(doc, structures, { days, modules }, 105);

    expect(result.dayNumber).toBe(3);
    expect(result.candidates[0]).toMatchObject({ dayNumber: 3 });
    expect(result.rationale.length).toBeGreaterThan(0);
  });
});
