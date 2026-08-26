import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import type { Mock } from "vitest";
import { reprocessCourseMaterial } from "./persistence";
import type { CourseJournalProposal } from "@/types/course-material";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const mockUser = { id: "user-reprocess" };

function makeProposal(overrides: Partial<CourseJournalProposal> = {}): CourseJournalProposal {
  return {
    curriculumDay: 3,
    moduleNumber: 2,
    moduleTitle: "Python Data Structures",
    topic: "Collections, Files & Errors",
    matchConfidence: "EXACT",
    journal: {
      whatILearned: "Learned about dictionaries and sets.",
      whatIPracticed: "I practiced dictionaries.",
      whatIBuilt: null,
      challenge: "Sets were confusing.",
      howISolvedIt: "Read the docs.",
      keyTakeaway: "Collections are fundamental.",
      tomorrowFocus: "(Suggested) Continue with Day 4: Web APIs",
      projectName: null,
      projectDescription: null,
      codeReference: "collections_utils.py",
      resourcesUsed: "Course PDF: course.pdf",
      confidenceLevel: null,
      additionalNotes: null,
    },
    evidence: [
      { field: "whatILearned", sourceType: "pdf", pageNumbers: [1], confidence: "SUPPORTED_BY_PDF" as const },
      { field: "whatIPracticed", sourceType: "user", pageNumbers: [], confidence: "USER_CONFIRMED" as const },
      { field: "whatIBuilt", sourceType: "missing", pageNumbers: [], confidence: "MISSING" as const },
      { field: "challenge", sourceType: "user", pageNumbers: [], confidence: "USER_CONFIRMED" as const },
      { field: "howISolvedIt", sourceType: "user", pageNumbers: [], confidence: "USER_CONFIRMED" as const },
      { field: "keyTakeaway", sourceType: "pdf", pageNumbers: [1], confidence: "SUPPORTED_BY_PDF" as const },
      { field: "tomorrowFocus", sourceType: "curriculum", pageNumbers: [], confidence: "INFERRED_FROM_STRUCTURE" as const },
      { field: "projectName", sourceType: "missing", pageNumbers: [], confidence: "MISSING" as const },
      { field: "projectDescription", sourceType: "missing", pageNumbers: [], confidence: "MISSING" as const },
      { field: "codeReference", sourceType: "pdf", pageNumbers: [1], confidence: "SUPPORTED_BY_PDF" as const },
      { field: "resourcesUsed", sourceType: "user", pageNumbers: [], confidence: "USER_CONFIRMED" as const },
      { field: "confidenceLevel", sourceType: "missing", pageNumbers: [], confidence: "MISSING" as const },
      { field: "additionalNotes", sourceType: "missing", pageNumbers: [], confidence: "MISSING" as const },
    ],
    missingFields: ["whatIBuilt", "projectName", "projectDescription", "confidenceLevel"],
    warnings: [],
    candidates: [],
    rationale: [],
    builtBy: "deterministic",
    explicitDayMatch: true,
    ...overrides,
  };
}

function setupDb(existingProposal: CourseJournalProposal | null) {
  const materials = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: existingProposal
        ? {
            id: "doc-reprocess",
            profile_id: mockUser.id,
            file_name: "course.pdf",
            storage_path: "user-reprocess/doc-reprocess/course.pdf",
            page_count: 2,
            processing_status: "completed",
            journal_proposal: existingProposal,
          }
        : null,
      error: existingProposal ? null : { message: "Not found", code: "PGRST116" },
    }),
  };

  const pages = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({
      data: [
        { page_number: 1, extracted_text: "Day 3: Collections. This chapter covers dictionaries, sets, and comprehensions." },
        { page_number: 2, extracted_text: "More content about Python data structures." },
      ],
      error: null,
    }),
  };

  const curriculumDays = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({
      data: [
        { id: "d3", day_number: 3, module_id: "m2", week_number: null, topic: "Collections", content: "Dictionaries and sets.", subtopics: [], project_information: null, assessment_information: null, created_at: "", updated_at: "" },
        { id: "d4", day_number: 4, module_id: "m2", week_number: null, topic: "Web APIs", content: "Requests.", subtopics: [], project_information: null, assessment_information: null, created_at: "", updated_at: "" },
      ],
      error: null,
    }),
  };

  const modules = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({
      data: [
        { id: "m2", module_number: 2, title: "Python Data Structures", description: null, weeks: null, days: null, hours: null, start_day: 11, end_day: 25, created_at: "", updated_at: "" },
      ],
      error: null,
    }),
  };

  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "course_materials") return materials;
      if (table === "course_material_pages") return pages;
      if (table === "curriculum_days") return curriculumDays;
      if (table === "modules") return modules;
      throw new Error(`unexpected table ${table}`);
    }),
  };

  (createClient as Mock).mockResolvedValue(supabase);
  return { materials, pages };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("reprocessCourseMaterial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves USER_CONFIRMED fields from the existing proposal", async () => {
    const existingProposal = makeProposal();
    setupDb(existingProposal);

    const result = await reprocessCourseMaterial("doc-reprocess");

    // USER_CONFIRMED fields should be preserved
    expect(result.proposal.journal.whatIPracticed).toBe("I practiced dictionaries.");
    expect(result.proposal.journal.challenge).toBe("Sets were confusing.");
    expect(result.proposal.journal.howISolvedIt).toBe("Read the docs.");

    // Their evidence should also be preserved
    const practicedEvidence = result.proposal.evidence.find((e) => e.field === "whatIPracticed");
    expect(practicedEvidence?.confidence).toBe("USER_CONFIRMED");
  });

  it("does not overwrite USER_CONFIRMED with PDF-extracted values", async () => {
    const existingProposal = makeProposal();
    setupDb(existingProposal);

    const result = await reprocessCourseMaterial("doc-reprocess");

    // Even though the new proposal might generate different values,
    // USER_CONFIRMED fields stay the same
    expect(result.proposal.journal.whatIPracticed).toBe("I practiced dictionaries.");
  });

  it("allows non-USER_CONFIRMED fields to be updated", async () => {
    const existingProposal = makeProposal({
      journal: {
        ...makeProposal().journal,
        whatILearned: "Old extracted value",
      },
    });
    setupDb(existingProposal);

    const result = await reprocessCourseMaterial("doc-reprocess");

    // whatILearned is SUPPORTED_BY_PDF, so it gets regenerated
    expect(result.proposal.journal.whatILearned).not.toBe("Old extracted value");
    expect(result.proposal.journal.whatILearned).toContain("dictionaries");
  });

  it("throws when material is not found", async () => {
    setupDb(null);

    await expect(reprocessCourseMaterial("nonexistent")).rejects.toThrow();
  });

  it("throws when no extracted pages exist", async () => {
    const existingProposal = makeProposal();
    const materials = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "doc-reprocess",
          profile_id: mockUser.id,
          file_name: "course.pdf",
          storage_path: "user-reprocess/doc-reprocess/course.pdf",
          page_count: 2,
          processing_status: "completed",
          journal_proposal: existingProposal,
        },
        error: null,
      }),
    };

    const pages = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "course_materials") return materials;
        if (table === "course_material_pages") return pages;
        return { select: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: [], error: null }) };
      }),
    };

    (createClient as Mock).mockResolvedValue(supabase);

    await expect(reprocessCourseMaterial("doc-reprocess")).rejects.toThrow();
  });
});
