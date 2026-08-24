// @vitest-environment node
// PDF parsing needs real Node APIs (streams/buffers) — run outside jsdom.

import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { analyzePages, extractPdfText } from "./extraction";
import { buildTestPdf } from "@/tests/fixtures/pdf-fixture";
import { AppError } from "@/lib/utils/errors";

describe("extractPdfText", () => {
  it("extracts text from a single-page PDF", async () => {
    const bytes = buildTestPdf(["The course covers variables and data types."]);
    const doc = await extractPdfText("single.pdf", bytes);

    expect(doc.fileName).toBe("single.pdf");
    expect(doc.pageCount).toBe(1);
    expect(doc.pages[0]!.pageNumber).toBe(1);
    expect(doc.pages[0]!.text).toContain("variables and data types");
  });

  it("extracts a multi-page PDF with page numbers preserved", async () => {
    const bytes = buildTestPdf([
      "Module 1: Foundations\nThis module covers Git basics.",
      "Day 2: Terminal\nThe course explains shell navigation.",
      "Assessment: quiz\nGrading is based on exercises.",
    ]);
    const doc = await extractPdfText("multi.pdf", bytes);

    expect(doc.pageCount).toBe(3);
    expect(doc.pages.map((p) => p.pageNumber)).toEqual([1, 2, 3]);
    expect(doc.pages[1]!.text).toContain("shell navigation");
    expect(doc.pages[2]!.text).toContain("quiz");
  });

  it("preserves line structure within pages", async () => {
    const bytes = buildTestPdf(["Title Line\nBody line one\nBody line two"]);
    const doc = await extractPdfText("lines.pdf", bytes);
    const lines = doc.pages[0]!.text.split("\n").map((l) => l.trim()).filter(Boolean);

    expect(lines).toEqual(["Title Line", "Body line one", "Body line two"]);
  });

  it("handles empty pages without crashing", async () => {
    const bytes = buildTestPdf(["Content here", "", "More content"]);
    const doc = await extractPdfText("empty-page.pdf", bytes);

    expect(doc.pageCount).toBe(3);
    // Whitespace-only page normalizes to empty/blank text.
    expect(doc.pages[1]!.text.trim()).toBe("");
  });

  it("escapes special characters in content safely", async () => {
    const bytes = buildTestPdf(["Sets look like: {1, 2, (3)} and tuples use (a, b)."]);
    const doc = await extractPdfText("special.pdf", bytes);
    expect(doc.pages[0]!.text).toContain("{1, 2, (3)}");
  });

  it("rejects corrupted PDFs with a clear error", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.4 this is not really a pdf at all");
    await expect(extractPdfText("corrupt.pdf", bytes)).rejects.toThrowError(AppError);
    try {
      await extractPdfText("corrupt.pdf", bytes);
    } catch (err) {
      expect((err as AppError).code).toBe("PDF_EXTRACTION_FAILED");
    }
  });
});

describe("analyzePages", () => {
  it("detects headings and code lines for structural hints", () => {
    const doc = {
      fileName: "s.pdf",
      pageCount: 1,
      pages: [
        {
          pageNumber: 1,
          text: [
            "MODULE 2: PYTHON PROGRAMMING",
            "",
            "This module covers dictionaries and sets in depth.",
            "",
            "def add(a, b):",
            "    return a + b",
            "",
            "Example project: build a price tracker application.",
          ].join("\n"),
        },
      ],
    };

    const s = analyzePages(doc)[0]!;

    expect(s.pageNumber).toBe(1);
    expect(s.headings.some((h) => h.includes("MODULE 2"))).toBe(true);
    expect(s.codeLines.length).toBeGreaterThan(0);
  });
});
