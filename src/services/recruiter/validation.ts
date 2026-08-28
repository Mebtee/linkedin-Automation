import { AppError } from "@/lib/utils/errors";
import type { EvidenceType } from "@/types/course-material";
import type {
  ContentGoal,
  ContentOpportunityEvidenceReference,
  ContentOpportunitySourceKind,
  ContentOpportunityStatus,
  CreateContentOpportunityInput,
  PostType,
} from "@/types/content-opportunity";
import {
  ALLOWED_OPPORTUNITY_STATUS_TRANSITIONS,
  CONTENT_GOALS,
  POST_TYPES,
} from "@/types/content-opportunity";

// ─── Validators ───────────────────────────────────────────────────────────────
// Small, strict helpers used by the persistence service and server actions.
// They mirror the validation style used by journal/generated-posts modules.

const OPPORTUNITY_STATUSES: readonly string[] = [
  "candidate",
  "selected",
  "generated",
  "approved",
  "published",
  "rejected",
];

const SOURCE_TYPES: readonly string[] = ["course-material", "journal", "project-evidence"];

const EVIDENCE_CONFIDENCE: readonly string[] = [
  "USER_CONFIRMED",
  "SUPPORTED_BY_PDF",
  "INFERRED_FROM_STRUCTURE",
  "MISSING",
];

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function toTrimmedString(value: unknown, label: string, maxLength: number): string {
  if (!isString(value) || value.trim().length === 0) {
    throw new AppError(`${label} must be a non-empty string.`, { code: "VALIDATION_ERROR" });
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new AppError(`${label} must be at most ${maxLength} characters.`, {
      code: "VALIDATION_ERROR",
    });
  }
  return trimmed;
}

export function validatePostType(value: unknown): PostType {
  if (typeof value !== "string" || !(POST_TYPES as readonly string[]).includes(value)) {
    throw new AppError("Invalid post type.", { code: "VALIDATION_ERROR" });
  }
  return value as PostType;
}

export function validateContentGoal(value: unknown): ContentGoal {
  if (typeof value !== "string" || !(CONTENT_GOALS as readonly string[]).includes(value)) {
    throw new AppError("Invalid content goal.", { code: "VALIDATION_ERROR" });
  }
  return value as ContentGoal;
}

export function validateOpportunityStatus(value: unknown): ContentOpportunityStatus {
  if (typeof value !== "string" || !OPPORTUNITY_STATUSES.includes(value)) {
    throw new AppError("Invalid content opportunity status.", { code: "VALIDATION_ERROR" });
  }
  return value as ContentOpportunityStatus;
}

export function validateOpportunitySourceType(value: unknown): ContentOpportunitySourceKind {
  if (typeof value !== "string" || !SOURCE_TYPES.includes(value)) {
    throw new AppError("Invalid opportunity source type.", { code: "VALIDATION_ERROR" });
  }
  return value as ContentOpportunitySourceKind;
}

export function validateOpportunityStatusTransition(
  from: ContentOpportunityStatus,
  to: ContentOpportunityStatus,
): void {
  const allowed = ALLOWED_OPPORTUNITY_STATUS_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new AppError(
      `Status cannot change from "${from}" to "${to}".`,
      { code: "INVALID_STATUS" },
    );
  }
}

export function validateRecruiterScore(value: unknown): number {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new AppError("Recruiter score must be a number between 0 and 100.", {
      code: "VALIDATION_ERROR",
    });
  }
  return Math.round(score);
}

export function validateEvidenceReferences(
  value: unknown,
): ContentOpportunityEvidenceReference[] {
  if (!Array.isArray(value)) {
    throw new AppError("Evidence must be an array.", { code: "VALIDATION_ERROR" });
  }

  return value.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new AppError("Each evidence reference must be an object.", {
        code: "VALIDATION_ERROR",
      });
    }
    const record = entry as Record<string, unknown>;
    const field = isString(record.field) ? record.field.trim() : "";
    if (!field) {
      throw new AppError("Each evidence reference needs a field name.", {
        code: "VALIDATION_ERROR",
      });
    }
    const confidence = record.confidence;
    if (
      typeof confidence !== "string" ||
      !EVIDENCE_CONFIDENCE.includes(confidence)
    ) {
      throw new AppError(`Invalid evidence confidence for "${field}".`, {
        code: "VALIDATION_ERROR",
      });
    }
    const pageNumbers = Array.isArray(record.pageNumbers)
      ? record.pageNumbers.filter((page): page is number => Number.isInteger(page))
      : [];
    return {
      field,
      pageNumbers,
      confidence: confidence as EvidenceType,
    };
  });
}

/**
 * Validates and normalizes a create input. `profile_id` is added by the
 * persistence service from the authenticated session — never from client input.
 */
export function validateCreateOpportunityInput(
  value: unknown,
): Omit<CreateContentOpportunityInput, "source_id" | "day_number" | "module_number" | "dedup_key"> & {
  readonly source_id: string | null;
  readonly day_number: number | null;
  readonly module_number: number | null;
  readonly dedup_key: string | null;
} {
  if (!value || typeof value !== "object") {
    throw new AppError("Opportunity input is required.", { code: "VALIDATION_ERROR" });
  }
  const input = value as Record<string, unknown>;

  const postType = validatePostType(input.post_type);
  const contentGoal = validateContentGoal(input.content_goal);
  const status =
    input.status === undefined
      ? "candidate"
      : validateOpportunityStatus(input.status);

  const title = toTrimmedString(input.title, "Title", 140);
  const summary =
    input.summary === undefined || input.summary === null
      ? null
      : toTrimmedString(input.summary, "Summary", 600);

  const evidence = validateEvidenceReferences(input.evidence ?? []);
  const recruiterScore = validateRecruiterScore(input.recruiter_score ?? 0);

  const sourceType = validateOpportunitySourceType(input.source_type);
  const sourceId = isString(input.source_id) ? input.source_id : null;
  const dayNumber =
    input.day_number === null || input.day_number === undefined
      ? null
      : Number(input.day_number);
  const moduleNumber =
    input.module_number === null || input.module_number === undefined
      ? null
      : Number(input.module_number);

  if (dayNumber !== null && (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 105)) {
    throw new AppError("day_number must be between 1 and 105.", {
      code: "VALIDATION_ERROR",
    });
  }
  if (moduleNumber !== null && !Number.isInteger(moduleNumber)) {
    throw new AppError("module_number must be an integer.", { code: "VALIDATION_ERROR" });
  }

  const selectionReason =
    input.selection_reason === undefined || input.selection_reason === null
      ? null
      : toTrimmedString(input.selection_reason, "Selection reason", 500);

  const dedupKey = isString(input.dedup_key) ? input.dedup_key.trim() || null : null;

  return {
    post_type: postType,
    content_goal: contentGoal,
    status,
    title,
    summary,
    evidence,
    recruiter_score: recruiterScore,
    recruiter_score_breakdown:
      typeof input.recruiter_score_breakdown === "object" &&
      input.recruiter_score_breakdown !== null
        ? (input.recruiter_score_breakdown as CreateContentOpportunityInput["recruiter_score_breakdown"])
        : null,
    selection_reason: selectionReason,
    source_type: sourceType,
    source_id: sourceId,
    day_number: dayNumber,
    module_number: moduleNumber,
    dedup_key: dedupKey,
  };
}