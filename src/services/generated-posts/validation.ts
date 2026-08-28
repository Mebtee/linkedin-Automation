import { AppError } from "@/lib/utils/errors";
import { brand } from "@/config/brand";
import type {
  GeneratedPostStatus,
  CreateGeneratedPostInput,
  UpdateGeneratedPostInput,
} from "@/types/generated-post";
import { ALLOWED_POST_STATUS_TRANSITIONS, VALID_POST_FORMATS } from "@/types/generated-post";

// ─── Validation Functions ────────────────────────────────────────────────────

export function validateDayNumber(dayNumber: unknown): number {
  if (typeof dayNumber !== "number" || !Number.isInteger(dayNumber)) {
    throw new AppError("Day number must be an integer.", {
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

export function validatePostFormat(format: unknown): string {
  if (typeof format !== "string") {
    throw new AppError("Post format must be a string.", {
      code: "VALIDATION_ERROR",
    });
  }

  if (!(VALID_POST_FORMATS as readonly string[]).includes(format)) {
    throw new AppError(
      `Invalid post format "${format}". Must be one of: ${VALID_POST_FORMATS.join(", ")}`,
      { code: "VALIDATION_ERROR" },
    );
  }

  return format;
}

export function validateGeneratedPostStatus(status: unknown): GeneratedPostStatus {
  if (typeof status !== "string") {
    throw new AppError("Status must be a string.", {
      code: "VALIDATION_ERROR",
    });
  }

  const validStatuses = ["draft", "approved", "published", "failed"];
  if (!validStatuses.includes(status)) {
    throw new AppError(
      `Invalid status "${status}". Must be one of: ${validStatuses.join(", ")}`,
      { code: "VALIDATION_ERROR" },
    );
  }

  return status as GeneratedPostStatus;
}

export function validateStatusTransition(
  currentStatus: GeneratedPostStatus,
  newStatus: GeneratedPostStatus,
): void {
  const allowed = ALLOWED_POST_STATUS_TRANSITIONS[currentStatus];

  if (!allowed.includes(newStatus)) {
    throw new AppError(
      `Cannot transition from "${currentStatus}" to "${newStatus}". Allowed transitions: ${allowed.join(", ") || "none"}`,
      { code: "INVALID_STATUS" },
    );
  }
}

export function validateCreateInput(input: unknown): CreateGeneratedPostInput {
  if (!input || typeof input !== "object") {
    throw new AppError("Input must be a non-null object.", {
      code: "VALIDATION_ERROR",
    });
  }

  const obj = input as Record<string, unknown>;

  // Required fields
  if (typeof obj.journal_entry_id !== "string" || obj.journal_entry_id.trim() === "") {
    throw new AppError("journal_entry_id is required.", { code: "VALIDATION_ERROR" });
  }

  validateDayNumber(obj.day_number);
  validatePostFormat(obj.format);

  if (typeof obj.opening !== "string" || obj.opening.trim() === "") {
    throw new AppError("opening is required and must be a non-empty string.", {
      code: "VALIDATION_ERROR",
    });
  }

  if (typeof obj.body !== "string" || obj.body.trim() === "") {
    throw new AppError("body is required and must be a non-empty string.", {
      code: "VALIDATION_ERROR",
    });
  }

  if (typeof obj.takeaway !== "string" || obj.takeaway.trim() === "") {
    throw new AppError("takeaway is required and must be a non-empty string.", {
      code: "VALIDATION_ERROR",
    });
  }

  if (typeof obj.next_step !== "string" || obj.next_step.trim() === "") {
    throw new AppError("next_step is required and must be a non-empty string.", {
      code: "VALIDATION_ERROR",
    });
  }

  if (!Array.isArray(obj.hashtags)) {
    throw new AppError("hashtags must be an array.", { code: "VALIDATION_ERROR" });
  }

  if (typeof obj.provider !== "string" || obj.provider.trim() === "") {
    throw new AppError("provider is required.", { code: "VALIDATION_ERROR" });
  }

  if (typeof obj.model !== "string" || obj.model.trim() === "") {
    throw new AppError("model is required.", { code: "VALIDATION_ERROR" });
  }

  if (typeof obj.content_hash !== "string" || obj.content_hash.trim() === "") {
    throw new AppError("content_hash is required.", { code: "VALIDATION_ERROR" });
  }

  if (obj.opportunity_id !== undefined && obj.opportunity_id !== null) {
    if (typeof obj.opportunity_id !== "string" || obj.opportunity_id.trim() === "") {
      throw new AppError("opportunity_id must be a non-empty string.", {
        code: "VALIDATION_ERROR",
      });
    }
  }

  return input as CreateGeneratedPostInput;
}

export function validateUpdateInput(input: unknown): UpdateGeneratedPostInput {
  if (!input || typeof input !== "object") {
    throw new AppError("Input must be a non-null object.", {
      code: "VALIDATION_ERROR",
    });
  }

  const obj = input as Record<string, unknown>;

  // Validate optional fields if present
  if (obj.status !== undefined) {
    validateGeneratedPostStatus(obj.status);
  }

  if (obj.format !== undefined) {
    validatePostFormat(obj.format);
  }

  if (obj.opening !== undefined) {
    if (typeof obj.opening !== "string" || obj.opening.trim() === "") {
      throw new AppError("opening must be a non-empty string.", {
        code: "VALIDATION_ERROR",
      });
    }
  }

  if (obj.body !== undefined) {
    if (typeof obj.body !== "string" || obj.body.trim() === "") {
      throw new AppError("body must be a non-empty string.", {
        code: "VALIDATION_ERROR",
      });
    }
  }

  if (obj.takeaway !== undefined) {
    if (typeof obj.takeaway !== "string" || obj.takeaway.trim() === "") {
      throw new AppError("takeaway must be a non-empty string.", {
        code: "VALIDATION_ERROR",
      });
    }
  }

  if (obj.next_step !== undefined) {
    if (typeof obj.next_step !== "string" || obj.next_step.trim() === "") {
      throw new AppError("next_step must be a non-empty string.", {
        code: "VALIDATION_ERROR",
      });
    }
  }

  if (obj.hashtags !== undefined && !Array.isArray(obj.hashtags)) {
    throw new AppError("hashtags must be an array.", { code: "VALIDATION_ERROR" });
  }

  if (obj.content_hash !== undefined) {
    if (typeof obj.content_hash !== "string" || obj.content_hash.trim() === "") {
      throw new AppError("content_hash must be a non-empty string.", {
        code: "VALIDATION_ERROR",
      });
    }
  }

  return input as UpdateGeneratedPostInput;
}
