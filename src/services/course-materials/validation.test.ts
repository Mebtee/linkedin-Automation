import { describe, it, expect } from "vitest";

import {
  getMaxPdfSizeMb,
  getMaxPdfBytes,
  sanitizeFileName,
  validatePdfUpload,
} from "./validation";
import { buildTestPdf } from "@/tests/fixtures/pdf-fixture";
import { AppError } from "@/lib/utils/errors";

describe("sanitizeFileName", () => {
  it("keeps a clean filename", () => {
    expect(sanitizeFileName("python-course.pdf")).toBe("python-course.pdf");
  });

  it("strips path traversal components", () => {
    expect(sanitizeFileName("../../etc/passwd.pdf")).toBe("passwd.pdf");
    expect(sanitizeFileName("..\\..\\windows\\evil.pdf")).toBe("evil.pdf");
  });

  it("removes dangerous characters", () => {
    expect(sanitizeFileName('file<>:"|?*.pdf')).toBe("file.pdf");
    expect(sanitizeFileName("report\u00002026.pdf")).toBe("report2026.pdf");
  });

  it("normalizes whitespace into dot separators", () => {
    expect(sanitizeFileName("my   course   notes.pdf")).toBe("my.course.notes.pdf");
  });

  it("enforces .pdf suffix and length limit", () => {
    expect(sanitizeFileName("document.txt")).toBe("document.txt.pdf");
    const long = "x".repeat(200);
    expect(sanitizeFileName(`${long}.pdf`).length).toBeLessThanOrEqual(85);
  });

  it("falls back to a default name for empty input", () => {
    expect(sanitizeFileName("")).toBe("course-material.pdf");
    expect(sanitizeFileName(".pdf")).toBe("course-material.pdf");
  });
});

describe("getMaxPdfSizeMb", () => {
  it("defaults to 10 MB", () => {
    expect(getMaxPdfSizeMb()).toBe(10);
    expect(getMaxPdfBytes()).toBe(10 * 1024 * 1024);
  });

  it("honors MAX_PDF_SIZE_MB within sane bounds", () => {
    const original = process.env.MAX_PDF_SIZE_MB;
    try {
      process.env.MAX_PDF_SIZE_MB = "25";
      expect(getMaxPdfSizeMb()).toBe(25);
      process.env.MAX_PDF_SIZE_MB = "0";
      expect(getMaxPdfSizeMb()).toBe(10);
      process.env.MAX_PDF_SIZE_MB = "9999";
      expect(getMaxPdfSizeMb()).toBe(10);
      process.env.MAX_PDF_SIZE_MB = "abc";
      expect(getMaxPdfSizeMb()).toBe(10);
    } finally {
      if (original === undefined) delete process.env.MAX_PDF_SIZE_MB;
      else process.env.MAX_PDF_SIZE_MB = original;
    }
  });
});

describe("validatePdfUpload", () => {
  const validPdf = buildTestPdf(["Hello world content"]);

  it("accepts a valid PDF and sanitizes its name", () => {
    const result = validatePdfUpload({ fileName: "../evil/My Course.PDF", bytes: validPdf });
    expect(result.fileName).toBe("My.Course.pdf");
    expect(result.bytes).toBe(validPdf);
  });

  it("rejects an empty file", () => {
    expect(() =>
      validatePdfUpload({ fileName: "a.pdf", bytes: new Uint8Array(0) }),
    ).toThrowError(AppError);
    try {
      validatePdfUpload({ fileName: "a.pdf", bytes: new Uint8Array(0) });
    } catch (err) {
      expect((err as AppError).code).toBe("PDF_EMPTY");
    }
  });

  it("rejects files above the size limit", () => {
    // A buffer that claims %PDF but exceeds even a shrunken limit.
    const original = process.env.MAX_PDF_SIZE_MB;
    try {
      process.env.MAX_PDF_SIZE_MB = "1";
      const big = new Uint8Array(1 * 1024 * 1024 + 1);
      big.set(new TextEncoder().encode("%PDF-1.4"), 0);
      try {
        validatePdfUpload({ fileName: "big.pdf", bytes: big });
        expect.unreachable("should have thrown");
      } catch (err) {
        expect((err as AppError).code).toBe("PDF_TOO_LARGE");
      }
    } finally {
      if (original === undefined) delete process.env.MAX_PDF_SIZE_MB;
      else process.env.MAX_PDF_SIZE_MB = original;
    }
  });

  it("rejects non-PDF content regardless of client MIME/filename", () => {
    const fake = new TextEncoder().encode("<html><body>not a pdf</body></html>");
    try {
      validatePdfUpload({ fileName: "looks-fine.pdf", bytes: fake });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as AppError).code).toBe("PDF_NOT_PDF");
    }
  });

  it("rejects text masquerading as PDF", () => {
    const text = new TextEncoder().encode("just some plain text notes");
    expect(() => validatePdfUpload({ fileName: "notes.pdf", bytes: text })).toThrowError(AppError);
  });

  it("handles corrupted-but-marked PDFs (magic present)", () => {
    // Magic bytes present but garbage afterwards — validation passes here;
    // extraction is responsible for rejecting it later in the pipeline.
    const bytes = new Uint8Array(2048);
    bytes.set(new TextEncoder().encode("%PDF-1.7"), 0);
    const result = validatePdfUpload({ fileName: "corrupt.pdf", bytes });
    expect(result.fileName).toBe("corrupt.pdf");
  });
});
