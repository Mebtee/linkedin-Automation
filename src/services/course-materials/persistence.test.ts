// @vitest-environment node
// Runs the real extraction pipeline (unpdf) against fixture PDFs.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import type { Mock } from "vitest";
import { ingestCourseMaterial } from "./persistence";
import { buildTestPdf } from "@/tests/fixtures/pdf-fixture";

const mockUser = { id: "user-1" };

function makeChain() {
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    limit: vi.fn().mockReturnThis(),
  };
}

describe("ingestCourseMaterial", () => {
  type Chain = ReturnType<typeof makeChain>;
  let supabase: {
    auth: { getUser: Mock };
    storage: { from: Mock };
    from: Mock;
  };
  const chains: Record<"materials" | "pages" | "curriculum" | "modules", Chain> = {
    materials: makeChain(),
    pages: makeChain(),
    curriculum: makeChain(),
    modules: makeChain(),
  };

  function setupDb() {
    // First .single() is the duplicate check — must return null (no duplicate).
    // Second .single() is the insert — must return the material record.
    chains.materials.single
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { id: "doc-1", profile_id: mockUser.id, processing_status: "processing" },
        error: null,
      });
    // .update(...).eq("id", ...) must resolve as an awaitable chain.
    chains.materials.update.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    chains.pages.insert.mockReturnValue({
      then: (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(onFulfilled?.({ data: null, error: null })),
    });

    chains.curriculum.order.mockResolvedValue({
      data: [
        {
          id: "d3", day_number: 3, module_id: "m2", week_number: null,
          topic: "Collections, Files & Errors",
          content: "Dictionaries, sets, comprehensions and modules.",
          subtopics: ["dictionaries", "sets", "comprehensions"],
          project_information: null, assessment_information: null,
          created_at: "", updated_at: "",
        },
      ],
      error: null,
    });

    chains.modules.order.mockResolvedValue({
      data: [
        {
          id: "m2", module_number: 2, title: "Python Data Structures",
          description: null, weeks: null, days: null, hours: null,
          start_day: 11, end_day: 25, created_at: "", updated_at: "",
        },
      ],
      error: null,
    });

    supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
          remove: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "course_materials") return chains.materials;
        if (table === "course_material_pages") return chains.pages;
        if (table === "curriculum_days") return chains.curriculum;
        if (table === "modules") return chains.modules;
        return makeChain();
      }),
    };

    (createClient as Mock).mockResolvedValue(supabase);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setupDb();
  });

  it("runs the full pipeline: store → extract → persist pages → match → propose", async () => {
    const pdfBytes = buildTestPdf([
      "Module 2 reading pack",
      "Day 3 lesson. This chapter covers dictionaries, sets, comprehensions and modules.",
    ]);

    const result = await ingestCourseMaterial("python-course.pdf", pdfBytes);

    // Storage upload used the owner-scoped private path (random document id).
    const storageMock = (supabase.storage.from as Mock).mock.results[0]!.value;
    expect(storageMock.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/[0-9a-f-]{36}\/python-course\.pdf$/),
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: "application/pdf" }),
    );

    // Extracted pages persisted with page numbers.
    expect(chains.pages.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        course_material_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        page_number: 1,
      }),
      expect.objectContaining({
        course_material_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        page_number: 2,
      }),
    ]);

    // Proposal matched Day 3 explicitly.
    expect(result.proposal.curriculumDay).toBe(3);
    expect(result.proposal.matchConfidence).toBe("EXACT");
    expect(result.pageCount).toBe(2);

    // Anti-hallucination invariants hold end-to-end.
    expect(result.proposal.journal.whatILearned).toContain("dictionaries");
    expect(result.proposal.journal.whatIPracticed).toBeNull();
    expect(result.proposal.journal.confidenceLevel).toBeNull();

    // Completion persisted.
    expect(chains.materials.update).toHaveBeenCalledWith(
      expect.objectContaining({ processing_status: "completed", page_count: 2 }),
    );
  });

  it("marks the record failed when extraction throws", async () => {
    const garbage = new TextEncoder().encode("%PDF-1.4 definitely not a real document body");
    await expect(ingestCourseMaterial("bad.pdf", garbage)).rejects.toThrowError();

    expect(chains.materials.update).toHaveBeenCalledWith(
      expect.objectContaining({ processing_status: "failed" }),
    );
  });

  it("rejects non-PDF uploads before any persistence", async () => {
    const notPdf = new TextEncoder().encode("<html>hi</html>");
    await expect(ingestCourseMaterial("fake.pdf", notPdf)).rejects.toThrowError();

    // No DB writes happened.
    expect(chains.materials.insert).not.toHaveBeenCalled();
  });

  it("marks failed when the PDF exceeds the size limit before persistence", async () => {
    const original = process.env.MAX_PDF_SIZE_MB;
    try {
      process.env.MAX_PDF_SIZE_MB = "1";
      const bytes = buildTestPdf(["x"]);
      const huge = new Uint8Array(1 * 1024 * 1024 + 1);
      huge.set(bytes.slice(0, 1000), 0);
      await expect(ingestCourseMaterial("huge.pdf", huge)).rejects.toMatchObject({
        code: "PDF_TOO_LARGE",
      });
      expect(chains.materials.insert).not.toHaveBeenCalled();
    } finally {
      if (original === undefined) delete process.env.MAX_PDF_SIZE_MB;
      else process.env.MAX_PDF_SIZE_MB = original;
    }
  });
});
