import { AppError } from "@/lib/utils/errors";
import type {
  PostGenerationInput,
  GeneratedPostPayload,
  PostFormat,
} from "@/types/ai";
import { POST_FORMATS } from "@/types/ai";

// ─── Input Validation ───────────────────────────────────────────────────────

export function validatePostGenerationInput(input: unknown): PostGenerationInput {
  if (!input || typeof input !== "object") {
    throw new AIValidationError("Input must be a non-null object", "INVALID_INPUT");
  }

  const obj = input as Record<string, unknown>;

  if (!obj.curriculum || typeof obj.curriculum !== "object") {
    throw new AIValidationError("Input must include a curriculum object", "INVALID_INPUT");
  }

  if (!obj.journal || typeof obj.journal !== "object") {
    throw new AIValidationError("Input must include a journal object", "INVALID_INPUT");
  }

  if (!obj.brandVoice || typeof obj.brandVoice !== "object") {
    throw new AIValidationError("Input must include a brandVoice object", "INVALID_INPUT");
  }

  if (!obj.format || !isPostFormat(obj.format)) {
    throw new AIValidationError(
      `Invalid format. Must be one of: ${POST_FORMATS.join(", ")}`,
      "INVALID_INPUT",
    );
  }

  if (!obj.rules || typeof obj.rules !== "object") {
    throw new AIValidationError("Input must include a rules object", "INVALID_INPUT");
  }

  const curriculum = obj.curriculum as Record<string, unknown>;
  if (typeof curriculum.dayNumber !== "number" || curriculum.dayNumber < 1) {
    throw new AIValidationError("curriculum.dayNumber must be a positive number", "INVALID_INPUT");
  }
  if (typeof curriculum.topic !== "string" || curriculum.topic.trim() === "") {
    throw new AIValidationError("curriculum.topic must be a non-empty string", "INVALID_INPUT");
  }

  return input as PostGenerationInput;
}

// ─── Output Validation ──────────────────────────────────────────────────────

export function validateGeneratedPostPayload(output: unknown): GeneratedPostPayload {
  if (!output || typeof output !== "object") {
    throw new AIValidationError("Output must be a non-null object", "INVALID_OUTPUT");
  }

  const obj = output as Record<string, unknown>;

  if (!obj.post || typeof obj.post !== "object") {
    throw new AIValidationError("Output must include a post object", "INVALID_OUTPUT");
  }

  if (!obj.image || typeof obj.image !== "object") {
    throw new AIValidationError("Output must include an image object", "INVALID_OUTPUT");
  }

  const post = obj.post as Record<string, unknown>;
  validatePostField(post, "opening");
  validatePostField(post, "body");
  validatePostField(post, "takeaway");
  validatePostField(post, "nextStep");
  validateHashtags(post);

  const image = obj.image as Record<string, unknown>;
  validatePostField(image, "headline");
  validatePostField(image, "subheadline");
  validateKeywords(image);
  validatePostField(image, "visualConcept");
  validatePostField(image, "template");

  return output as GeneratedPostPayload;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isPostFormat(value: unknown): value is PostFormat {
  return typeof value === "string" && (POST_FORMATS as readonly string[]).includes(value);
}

function validatePostField(obj: Record<string, unknown>, field: string): void {
  if (typeof obj[field] !== "string" || (obj[field] as string).trim() === "") {
    throw new AIValidationError(`Output post.${field} must be a non-empty string`, "INVALID_OUTPUT");
  }
}

function validateHashtags(obj: Record<string, unknown>): void {
  if (!Array.isArray(obj.hashtags)) {
    throw new AIValidationError("Output post.hashtags must be an array", "INVALID_OUTPUT");
  }
  for (const tag of obj.hashtags) {
    if (typeof tag !== "string") {
      throw new AIValidationError("Each hashtag must be a string", "INVALID_OUTPUT");
    }
  }
}

function validateKeywords(obj: Record<string, unknown>): void {
  if (!Array.isArray(obj.keywords)) {
    throw new AIValidationError("Output image.keywords must be an array", "INVALID_OUTPUT");
  }
}

// ─── AI Validation Error ────────────────────────────────────────────────────

export class AIValidationError extends AppError {
  constructor(message: string, code: "INVALID_INPUT" | "INVALID_OUTPUT") {
    super(message, { code });
    this.name = "AIValidationError";
  }
}
