import { AppError } from "@/lib/utils/errors";
import type { ImageGenerationInput } from "@/types/image";

// ─── Input Validation ───────────────────────────────────────────────────────

export function validateImageInput(input: unknown): ImageGenerationInput {
  if (!input || typeof input !== "object") {
    throw new ImageValidationError("Image input must be a non-null object", "IMAGE_INVALID_INPUT");
  }

  const obj = input as Record<string, unknown>;

  if (typeof obj.dayNumber !== "number" || !Number.isInteger(obj.dayNumber) || obj.dayNumber < 1) {
    throw new ImageValidationError("dayNumber must be a positive integer", "IMAGE_INVALID_INPUT");
  }

  if (typeof obj.topic !== "string" || obj.topic.trim() === "") {
    throw new ImageValidationError("topic must be a non-empty string", "IMAGE_INVALID_INPUT");
  }

  if (typeof obj.moduleNumber !== "number" || obj.moduleNumber < 1) {
    throw new ImageValidationError("moduleNumber must be a positive number", "IMAGE_INVALID_INPUT");
  }

  if (typeof obj.moduleTitle !== "string" || obj.moduleTitle.trim() === "") {
    throw new ImageValidationError("moduleTitle must be a non-empty string", "IMAGE_INVALID_INPUT");
  }

  if (typeof obj.headline !== "string" || obj.headline.trim() === "") {
    throw new ImageValidationError("headline must be a non-empty string", "IMAGE_INVALID_INPUT");
  }

  if (typeof obj.subheadline !== "string") {
    throw new ImageValidationError("subheadline must be a string", "IMAGE_INVALID_INPUT");
  }

  if (!Array.isArray(obj.keywords)) {
    throw new ImageValidationError("keywords must be an array", "IMAGE_INVALID_INPUT");
  }

  if (typeof obj.visualConcept !== "string") {
    throw new ImageValidationError("visualConcept must be a string", "IMAGE_INVALID_INPUT");
  }

  if (typeof obj.template !== "string" || obj.template.trim() === "") {
    throw new ImageValidationError("template must be a non-empty string", "IMAGE_INVALID_INPUT");
  }

  // Optional structured brief (Phase 5G). Validated only when present so the
  // classic path remains fully supported.
  if (obj.visualBrief != null) {
    const brief = obj.visualBrief as Record<string, unknown>;
    if (typeof brief !== "object" || brief === null) {
      throw new ImageValidationError("visualBrief must be an object", "IMAGE_INVALID_INPUT");
    }
    if (typeof brief.headline !== "string" || brief.headline.trim() === "") {
      throw new ImageValidationError("visualBrief.headline must be a non-empty string", "IMAGE_INVALID_INPUT");
    }
    if (!Array.isArray(brief.keyPoints)) {
      throw new ImageValidationError("visualBrief.keyPoints must be an array", "IMAGE_INVALID_INPUT");
    }
    if (!Array.isArray(brief.technologies)) {
      throw new ImageValidationError("visualBrief.technologies must be an array", "IMAGE_INVALID_INPUT");
    }
    if (typeof brief.theme !== "string" || brief.theme.trim() === "") {
      throw new ImageValidationError("visualBrief.theme must be a non-empty string", "IMAGE_INVALID_INPUT");
    }
    if (typeof brief.composition !== "string" || brief.composition.trim() === "") {
      throw new ImageValidationError("visualBrief.composition must be a non-empty string", "IMAGE_INVALID_INPUT");
    }
  }

  return input as ImageGenerationInput;
}

// ─── Output Validation ──────────────────────────────────────────────────────

export function validateImageOutput(output: unknown): { svg: string; width: number; height: number } {
  if (!output || typeof output !== "object") {
    throw new ImageValidationError("Image output must be a non-null object", "IMAGE_INVALID_OUTPUT");
  }

  const obj = output as Record<string, unknown>;

  if (typeof obj.svg !== "string" || obj.svg.trim() === "") {
    throw new ImageValidationError("Output svg must be a non-empty string", "IMAGE_INVALID_OUTPUT");
  }

  if (!obj.svg.includes("<svg")) {
    throw new ImageValidationError("Output svg must contain an SVG element", "IMAGE_INVALID_OUTPUT");
  }

  if (typeof obj.width !== "number" || obj.width <= 0) {
    throw new ImageValidationError("Output width must be a positive number", "IMAGE_INVALID_OUTPUT");
  }

  if (typeof obj.height !== "number" || obj.height <= 0) {
    throw new ImageValidationError("Output height must be a positive number", "IMAGE_INVALID_OUTPUT");
  }

  return {
    svg: obj.svg,
    width: obj.width,
    height: obj.height,
  };
}

// ─── Image Validation Error ─────────────────────────────────────────────────

export class ImageValidationError extends AppError {
  constructor(message: string, code: "IMAGE_INVALID_INPUT" | "IMAGE_INVALID_OUTPUT") {
    super(message, { code });
    this.name = "ImageValidationError";
  }
}
