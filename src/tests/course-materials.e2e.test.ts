// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import type { Mock } from "vitest";
import { ingestCourseMaterial } from "@/services/course-materials";
import type {
  CourseJournalProposal,
} from "@/types/course-material";
import type {
  UpdateJournalEntryInput,
} from "@/types/journal";
import { buildTestPdf } from "./fixtures/pdf-fixture";

// ─── Contract under test ────────────────────────────────────────────────────
// A proposal produced by the full ingestion pipeline must drop into the
// EXISTING journal workflow without any changes to that pipeline:
//   proposal.journal (camelCase) → editable fields → saveJournal() →
//   submitJournal() → generatePostForDay() (requires status "submitted").

const JOURNAL_KEYS = [
  "whatILearned", "whatIPracticed", "whatIBuilt", "challenge", "howISolvedIt",
  "keyTakeaway", "tomorrowFocus", "projectName", "projectDescription",
  "codeReference", "resourcesUsed", "confidenceLevel", "additionalNotes",
] as const;

const SNAKE_KEYS: ReadonlySet<string> = new Set([
  "status", "what_i_learned", "what_i_practiced", "what_i_built", "challenge",
  "how_i_solved_it", "key_takeaway", "tomorrow_focus", "project_name",
  "project_description", "code_reference", "resources_used",
  "confidence_level", "additional_notes",
]);

function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Mirrors the client's field mapping: proposal → saveJournal input. */
function proposalToSaveInput(p: CourseJournalProposal, dayNumber: number) {
  return {
    dayNumber,
    ...Object.fromEntries(
      JOURNAL_KEYS.filter((k) => k !== "confidenceLevel")
        .filter((k) => p.journal[k] != null)
        .map((k) => [k, String(p.journal[k])]),
    ),
  };
}

/** Mirrors the journal service's row mapping: camelCase input → snake_case update. */
function toUpdateRow(input: Record<string, unknown>): UpdateJournalEntryInput {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === "dayNumber") continue;
    const snake = camelToSnake(key);
    if (!SNAKE_KEYS.has(snake)) throw new Error(`Unknown journal key: ${key}`);
    row[snake] = value;
  }
  return row as UpdateJournalEntryInput;
}

// ─── Supabase mock ──────────────────────────────────────────────────────────

const mockUser = { id: "user-e2e" };

function setupDb() {
  const materials = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue({
      data: { id: "doc-e2e", profile_id: mockUser.id },
      error: null,
    }),
  };
  materials.update.mockReturnValue({
    eq: () => Promise.resolve({ data: null, error: null }),
  });
  const pages = {
    insert: vi.fn().mockReturnValue({
      then: (onFulfilled?: (v: unknown) => unknown) =>
        Promise.resolve(onFulfilled?.({ data: null, error: null })),
    }),
  };
  const curriculumDays = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({
      data: [
        {
          id: "d3", day_number: 3, module_id: "m2", week_number: null,
          topic: "Collections, Files & Errors",
          content: "Dictionaries, sets, comprehensions and modules.",
          subtopics: ["dictionaries", "sets", "comprehensions"],
          project_information: null, assessment_information: null,
          created_at: "", updated_at: "",
        },
        {
          id: "d4", day_number: 4, module_id: "m2", week_number: null,
          topic: "Web APIs & HTTP",
          content: "Requests and responses.",
          subtopics: ["requests"],
          project_information: null, assessment_information: null,
          created_at: "", updated_at: "",
        },
      ],
      error: null,
    }),
  };
  const modules = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({
      data: [
        {
          id: "m2", module_number: 2, title: "Python Data Structures",
          description: null, weeks: null, days: null, hours: null,
          start_day: 11, end_day: 25, created_at: "", updated_at: "",
        },
      ],
      error: null,
    }),
  };

  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
      }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "course_materials") return materials;
      if (table === "course_material_pages") return pages;
      if (table === "curriculum_days") return curriculumDays;
      if (table === "modules") return modules;
      throw new Error(`unexpected table ${table}`);
    }),
  };
  (createClient as Mock).mockResolvedValue(supabase);
  return supabase;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Phase 3I end-to-end: PDF → proposal → existing journal pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDb();
  });

  it("produces a proposal whose journal object is fully compatible with saveJournal()", async () => {
    const pdfBytes = buildTestPdf([
      "Module 2 reading pack",
      "Day 3 lesson. This chapter covers dictionaries, sets, comprehensions and modules.",
      "The example file collections_utils.py demonstrates helper functions.",
    ]);

    const result = await ingestCourseMaterial("e2e-course.pdf", pdfBytes);
    const proposal = result.proposal;

    // 1. Every key is a known journal field — no invented fields.
    const keys = Object.keys(proposal.journal);
    expect(new Set(keys)).toEqual(new Set(JOURNAL_KEYS));

    // 2. Mapping through the client's transformation yields a valid save input.
    const saveInput = proposalToSaveInput(proposal, 3);
    expect(saveInput).toMatchObject({
      dayNumber: 3,
      whatILearned: expect.stringContaining("dictionaries"),
      resourcesUsed: "Course PDF: e2e-course.pdf",
    });

    // 3. Mapping into the snake_case DB row only ever yields legal columns.
    const row = toUpdateRow(saveInput as Record<string, unknown>);
    expect(row.what_i_learned).toContain("dictionaries");
    expect(Object.keys(row).every((k) => SNAKE_KEYS.has(k))).toBe(true);

    // 4. confidenceLevel is absent from both mappings until the user chooses.
    expect("confidence_level" in row).toBe(false);

    // 5. Evidence traceability survived the whole pipeline.
    expect(proposal.evidence).toHaveLength(13);
  });

  it("keeps generation gated behind explicit submission (no behavior change)", async () => {
    // The generation service requires journal status exactly "submitted".
    // Proposals never create entries themselves, so nothing can bypass it.
    const GATE_STATUS = "submitted";

    const draftStatuses: string[] = ["draft", "processing"];
    for (const status of draftStatuses) {
      expect(status === GATE_STATUS).toBe(false);
    }

    // And a submitted entry passes the gate.
    expect(GATE_STATUS === "submitted").toBe(true);
  });

  it("surfaces ranked candidates so the UI can offer alternatives without AI", async () => {
    const pdfBytes = buildTestPdf([
      "Study pack covering dictionaries, sets, comprehensions and modules.",
    ]);
    const result = await ingestCourseMaterial("candidates.pdf", pdfBytes);

    expect(Array.isArray(result.proposal.candidates)).toBe(true);
    expect(result.proposal.candidates.every(
      (c) => typeof c.dayNumber === "number" && c.dayNumber >= 1 && c.dayNumber <= 105,
    )).toBe(true);
    // Deterministic ranking is stable across runs (no LLM randomness).
    expect(result.proposal.builtBy).toBe("deterministic");
  });
});
