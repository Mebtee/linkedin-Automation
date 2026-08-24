import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockIngest = vi.fn();
const mockGet = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/services/course-materials", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/course-materials")>();
  return {
    ...actual,
    ingestCourseMaterial: (...a: unknown[]) => mockIngest(...a),
    getOwnCourseMaterial: (...a: unknown[]) => mockGet(...a),
    deleteOwnCourseMaterial: (...a: unknown[]) => mockDelete(...a),
  };
});

import {
  uploadCourseMaterial,
  fetchCourseMaterial,
  deleteCourseMaterial,
} from "./course-materials";
import { buildTestPdf } from "@/tests/fixtures/pdf-fixture";
import { AppError } from "@/lib/utils/errors";

function makeProposal() {
  return {
    curriculumDay: null,
    moduleNumber: null,
    moduleTitle: null,
    topic: null,
    matchConfidence: "UNKNOWN",
    journal: {},
    evidence: [],
    missingFields: [],
    warnings: [],
    candidates: [],
    rationale: [],
    builtBy: "deterministic",
  };
}

describe("uploadCourseMaterial action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when no file is present in the form data", async () => {
    const formData = new FormData();
    const result = await uploadCourseMaterial(formData);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("No PDF");
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it("passes file bytes to the service and returns the proposal on success", async () => {
    const pdfBytes = buildTestPdf(["Day 1 content"]);
    const file = new File([pdfBytes as BlobPart], "my-course.pdf", { type: "application/pdf" });
    const formData = new FormData();
    formData.append("pdf", file);

    mockIngest.mockResolvedValue({
      documentId: "doc-9",
      fileName: "my-course.pdf",
      pageCount: 1,
      proposal: makeProposal(),
    });

    const result = await uploadCourseMaterial(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.documentId).toBe("doc-9");
      expect(result.proposal).toBeDefined();
    }
    const [nameArg, bytesArg] = mockIngest.mock.calls[0]!;
    expect(nameArg).toBe("my-course.pdf");
    expect(bytesArg).toBeInstanceOf(Uint8Array);
    // Content sniffed from real bytes, not the client-provided MIME type.
    expect(Array.from((bytesArg as Uint8Array).slice(0, 4))).toEqual(
      Array.from(pdfBytes.slice(0, 4)),
    );
  });

  it("maps service failures to friendly messages instead of throwing", async () => {
    const file = new File([new TextEncoder().encode("%PDF-1.4 x")], "broken.pdf");
    const formData = new FormData();
    formData.append("pdf", file);

    mockIngest.mockRejectedValue(
      new AppError("The uploaded file is not a valid PDF document.", { code: "PDF_NOT_PDF" }),
    );

    const result = await uploadCourseMaterial(formData);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/not a valid PDF/i);
  });
});

describe("fetchCourseMaterial action", () => {
  it("returns proposal for a completed owned document", async () => {
    const proposal = makeProposal();
    mockGet.mockResolvedValue({
      id: "doc-1",
      processing_status: "completed",
      journal_proposal: proposal,
      file_name: "course.pdf",
      page_count: 3,
    });

    const result = await fetchCourseMaterial("doc-1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.pageCount).toBe(3);
      expect(result.proposal).toBe(proposal);
    }
  });

  it("refuses documents that are still processing or failed", async () => {
    mockGet.mockResolvedValue({ processing_status: "processing", journal_proposal: null });
    const result = await fetchCourseMaterial("doc-2");
    expect(result.success).toBe(false);

    mockGet.mockResolvedValue({ processing_status: "failed", journal_proposal: null });
    const failed = await fetchCourseMaterial("doc-2");
    expect(failed.success).toBe(false);
  });

  it("handles missing documents and internal errors gracefully", async () => {
    mockGet.mockResolvedValue(null);
    expect((await fetchCourseMaterial("missing")).success).toBe(false);

    mockGet.mockRejectedValue(new Error("db down"));
    expect((await fetchCourseMaterial("doc-1")).success).toBe(false);
  });
});

describe("deleteCourseMaterial action", () => {
  it("reports success and failure without throwing", async () => {
    mockDelete.mockResolvedValue(undefined);
    expect(await deleteCourseMaterial("doc-1")).toEqual({ success: true });

    mockDelete.mockRejectedValue(new Error("rls denied"));
    const result = await deleteCourseMaterial("doc-1");
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
