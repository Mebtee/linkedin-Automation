import { AppError } from "@/lib/utils/errors";

// ─── Configuration ──────────────────────────────────────────────────────────

const DEFAULT_MAX_PDF_MB = 10;

/**
 * Server-configurable maximum PDF size in megabytes.
 * Set MAX_PDF_SIZE_MB to override the 10 MB default (see ENVIRONMENT.md).
 */
export function getMaxPdfSizeMb(): number {
  const raw = process.env.MAX_PDF_SIZE_MB;
  if (!raw) return DEFAULT_MAX_PDF_MB;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) return DEFAULT_MAX_PDF_MB;
  return parsed;
}

export function getMaxPdfBytes(): number {
  return getMaxPdfSizeMb() * 1024 * 1024;
}

// ─── Filename Sanitization ──────────────────────────────────────────────────

/**
 * Produces a safe storage filename: strips any path components (prevents
 * path traversal), keeps only a conservative character set, and guarantees a
 * lowercase .pdf suffix. Never trust the client-provided name as-is.
 */
export function sanitizeFileName(input: string): string {
  const base = input.split(/[/\\]/).pop() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001f<>:"|?*]/g, "")
    .replace(/[^A-Za-z0-9._ -]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[. ]+/g, ".")
    .trim();

  const withoutExt = cleaned.replace(/\.pdf$/i, "").slice(0, 80).trim() || "course-material";
  return `${withoutExt}.pdf`;
}

// ─── File Validation ────────────────────────────────────────────────────────

export type PdfFileInput = {
  readonly fileName: string;
  readonly bytes: Uint8Array;
};

export type ValidatedPdf = {
  readonly fileName: string;
  readonly bytes: Uint8Array;
};

/**
 * Validates an uploaded PDF. Checks are server-side and content-based:
 * - non-empty
 * - declared size within the configured limit
 * - actual file format verified via the %PDF magic marker (the client MIME
 *   type is never trusted)
 * - sanitized filename
 *
 * Throws AppError codes: PDF_EMPTY, PDF_TOO_LARGE, PDF_NOT_PDF, PDF_INVALID_NAME.
 */
export function validatePdfUpload(input: PdfFileInput): ValidatedPdf {
  const { bytes } = input;

  if (bytes.byteLength === 0) {
    throw new AppError("The uploaded file is empty.", { code: "PDF_EMPTY" });
  }

  if (bytes.byteLength > getMaxPdfBytes()) {
    throw new AppError(
      `The PDF exceeds the maximum size of ${getMaxPdfSizeMb()} MB.`,
      { code: "PDF_TOO_LARGE" },
    );
  }

  // Content sniffing: a real PDF starts with "%PDF-" within the first bytes.
  const header = new TextDecoder("latin1").decode(bytes.slice(0, 1024));
  if (!header.includes("%PDF-")) {
    throw new AppError(
      "The uploaded file is not a valid PDF document.",
      { code: "PDF_NOT_PDF" },
    );
  }

  return {
    fileName: sanitizeFileName(input.fileName),
    bytes,
  };
}

/** Safe error message for clients — never leaks internals. */
export function pdfErrorMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  return "The course material could not be processed. Please try a different PDF.";
}

// ─── Content Hash ───────────────────────────────────────────────────────────

/**
 * Computes a SHA-256 hex digest of the raw PDF bytes.
 * Used for deterministic duplicate detection: same user + same hash = duplicate.
 * Runs server-side only via Web Crypto API.
 */
export async function computeContentHash(bytes: Uint8Array): Promise<string> {
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
