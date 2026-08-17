import { AppError } from "@/lib/utils/errors";
import { brand } from "@/config/brand";

const MAX_TEXT_LENGTH = 5000;

const TEXT_FIELDS = [
  "what_i_learned",
  "what_i_practiced",
  "what_i_built",
  "challenge",
  "how_i_solved_it",
  "key_takeaway",
  "tomorrow_focus",
  "project_name",
  "project_description",
  "code_reference",
  "resources_used",
  "additional_notes",
] as const;

type JournalInput = Record<string, unknown>;

/**
 * Validates that a day_number is a valid curriculum day (1–totalDays).
 */
export function validateDayNumber(dayNumber: unknown): number {
  if (typeof dayNumber !== "number" || !Number.isInteger(dayNumber)) {
    throw new AppError("Day number must be a whole number.", {
      code: "VALIDATION_ERROR",
    });
  }

  if (dayNumber < 1 || dayNumber > brand.totalDays) {
    throw new AppError(
      `Day number must be between 1 and ${brand.totalDays}. Received ${dayNumber}.`,
      { code: "VALIDATION_ERROR" },
    );
  }

  return dayNumber;
}

/**
 * Validates that a confidence level is between 1 and 5 (or null).
 */
function validateConfidenceLevel(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new AppError("Confidence level must be a whole number between 1 and 5.", {
      code: "VALIDATION_ERROR",
    });
  }

  if (value < 1 || value > 5) {
    throw new AppError("Confidence level must be between 1 and 5.", {
      code: "VALIDATION_ERROR",
    });
  }

  return value;
}

/**
 * Sanitizes a text field: trims whitespace, returns null for empty strings.
 */
function sanitizeTextField(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed === "") return null;

  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw new AppError(
      `Text field exceeds maximum length of ${MAX_TEXT_LENGTH} characters.`,
      { code: "VALIDATION_ERROR" },
    );
  }

  return trimmed;
}

/**
 * Validates and sanitizes journal input fields.
 * Returns a clean object with only valid fields.
 * Throws AppError for invalid values.
 */
export function validateJournalInput(input: JournalInput): JournalInput {
  const cleaned: JournalInput = {};

  for (const field of TEXT_FIELDS) {
    if (field in input) {
      cleaned[field] = sanitizeTextField(input[field]);
    }
  }

  if ("confidence_level" in input) {
    cleaned.confidence_level = validateConfidenceLevel(input.confidence_level);
  }

  return cleaned;
}

/**
 * Checks if a journal entry has enough content to be submitted.
 * At least one of the core learning fields must be non-empty.
 */
function hasMinimumContent(entry: {
  what_i_learned: string | null;
  what_i_practiced: string | null;
  what_i_built: string | null;
  key_takeaway: string | null;
}): boolean {
  return (
    entry.what_i_learned !== null ||
    entry.what_i_practiced !== null ||
    entry.what_i_built !== null ||
    entry.key_takeaway !== null
  );
}

/**
 * Validates that a journal entry can be submitted.
 * Throws AppError if the entry is effectively empty.
 */
export function validateSubmission(entry: {
  what_i_learned: string | null;
  what_i_practiced: string | null;
  what_i_built: string | null;
  key_takeaway: string | null;
}): void {
  if (!hasMinimumContent(entry)) {
    throw new AppError(
      "Journal entry must contain at least one of: what you learned, what you practiced, what you built, or your key takeaway.",
      { code: "VALIDATION_ERROR" },
    );
  }
}

/**
 * Validates that a status value is a valid transition.
 * The client should not be able to set status to "used" directly.
 */
export function validateStatusTransition(
  currentStatus: string,
  newStatus: string,
): void {
  const allowedTransitions: Record<string, string[]> = {
    draft: ["submitted"],
    submitted: ["draft", "submitted"],
    used: [],
  };

  const allowed = allowedTransitions[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new AppError(
      `Cannot change status from "${currentStatus}" to "${newStatus}".`,
      { code: "INVALID_STATUS" },
    );
  }
}
