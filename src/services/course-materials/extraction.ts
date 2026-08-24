import "server-only";

import { extractText, getDocumentProxy } from "unpdf";

import { AppError } from "@/lib/utils/errors";
import type { ExtractedPdfDocument, ExtractedPdfPage } from "@/types/course-material";

/**
 * Server-side PDF text extraction.
 *
 * Uses pdf.js (via unpdf) locally on the server. The raw PDF is NEVER sent
 * to any external service — only extracted text flows onward (and only to
 * the configured AI provider, delimited as untrusted data).
 *
 * The PDF and everything extracted from it is untrusted input: callers must
 * treat page text as data, never as instructions.
 */
export async function extractPdfText(
  fileName: string,
  bytes: Uint8Array,
): Promise<ExtractedPdfDocument> {
  let pages: string[];

  try {
    const copy = new Uint8Array(bytes);
    const pdf = await getDocumentProxy(copy);
    const result = await extractText(pdf, { mergePages: false });
    pages = result.text;
  } catch {
    throw new AppError(
      "The PDF could not be read. It may be corrupted or password-protected.",
      { code: "PDF_EXTRACTION_FAILED" },
    );
  }

  if (!pages || pages.length === 0) {
    throw new AppError(
      "The PDF contains no readable pages.",
      { code: "PDF_EXTRACTION_FAILED" },
    );
  }

  const extractedPages: ExtractedPdfPage[] = pages.map((text, index) => ({
    pageNumber: index + 1,
    text: text ?? "",
  }));

  return {
    fileName,
    pageCount: extractedPages.length,
    pages: extractedPages,
  };
}

// ─── Lightweight Structure Detection ────────────────────────────────────────

const MAX_HEADING_LENGTH = 90;

/** A line is considered a heading when it is short, non-empty, title-like. */
function looksLikeHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_HEADING_LENGTH) return false;
  if (/[.,;]$/.test(trimmed)) return false;

  const words = trimmed.split(/\s+/);
  if (words.length > 14) return false;

  const allCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
  const numbered = /^(chapter|module|lesson|day|unit|section|part)\b/i.test(trimmed);
  const titleCase = words.every(
    (w) => w.length <= 3 || /^[A-Z]/.test(w) || /^[0-9]/.test(w),
  );

  return allCaps || numbered || titleCase;
}

const CODE_HINTS = [
  /^\s{4,}/,
  /^[{}()[\]]|;$/,
  /\b(def|class|function|const|let|var|return|import|from|for|while|if|else)\b/,
  />>>|\$\s|=>/,
];

function looksLikeCode(line: string): boolean {
  if (line.trim().length === 0) return false;
  return CODE_HINTS.some((re) => re.test(line));
}

export type PageStructure = {
  readonly pageNumber: number;
  readonly headings: readonly string[];
  readonly codeLines: readonly string[];
  readonly text: string;
};

/** Splits extracted text into structural hints used by matching/builder. */
export function analyzePages(doc: ExtractedPdfDocument): readonly PageStructure[] {
  return doc.pages.map((page) => {
    const lines = page.text.split(/\r?\n/);
    return {
      pageNumber: page.pageNumber,
      headings: lines.filter(looksLikeHeading),
      codeLines: lines.filter(looksLikeCode),
      text: page.text,
    };
  });
}
