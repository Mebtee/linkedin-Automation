import { AppError } from "@/lib/utils/errors";
import type { ImageGenerationInput, VisualBrief } from "@/types/image";
import { IMAGE_TEMPLATES, RECRUITER_EMPHASES } from "@/types/image";

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

  if (typeof obj.template !== "string" || !IMAGE_TEMPLATES.includes(obj.template as ImageGenerationInput["template"])) {
    throw new ImageValidationError("template must be a valid image template", "IMAGE_INVALID_INPUT");
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

// ─── Visual Brief Validation (Phase 5H) ─────────────────────────────────────

/**
 * Tokens that would indicate an unsupported / invented claim if they ever
 * appeared on an image. None are produced by the evidence-safe extractors, so
 * their presence is a reliable signal of hallucination or a regression.
 */
const HALLUCINATION_TOKENS = [
  "users",
  "revenue",
  "million",
  "customers",
  " years of experience",
  " years experience",
  "certified",
  "10k",
  "5k",
  "10,000",
  "clients",
];

/**
 * Validates a VisualBrief for mobile-safe length limits and anti-hallucination.
 * Returns a list of issues (empty means valid). It never throws — callers can
 * fall back gracefully when issues are found.
 */
export function validateVisualBrief(brief: VisualBrief): string[] {
  const issues: string[] = [];
  if (!brief) return ["visualBrief is required"];

  if (!brief.headline || brief.headline.trim() === "") {
    issues.push("headline is empty");
  } else if (brief.headline.length > 60) {
    issues.push(`headline exceeds 60 chars (${brief.headline.length})`);
  }

  if (brief.subheadline && brief.subheadline.length > 110) {
    issues.push(`subheadline exceeds 110 chars (${brief.subheadline.length})`);
  }

  for (const kp of brief.keyPoints ?? []) {
    if (kp.label.length > 30) issues.push(`key point label exceeds 30 chars: "${kp.label}"`);
    if (kp.detail.length > 44) issues.push("key point detail exceeds 44 chars");
  }

  const metaphors = brief.visualMetaphor ? brief.visualMetaphor.split("→") : [];
  for (const m of metaphors) {
    if (m.trim().length > 24) issues.push(`metaphor node exceeds 24 chars: "${m.trim()}"`);
  }

  if (brief.emphasis && !RECRUITER_EMPHASES.includes(brief.emphasis)) {
    issues.push(`unknown emphasis: ${brief.emphasis}`);
  }

  // Anti-hallucination: reject fabricated metrics/claims anywhere in the brief.
  const scanTarget = [
    brief.headline,
    brief.subheadline,
    brief.concept,
    brief.visualMetaphor,
    ...(brief.keyPoints ?? []).map((k) => `${k.label} ${k.detail}`),
    ...(brief.technologies ?? []),
  ].join(" ").toLowerCase();
  for (const token of HALLUCINATION_TOKENS) {
    if (scanTarget.includes(token)) {
      issues.push(`potential unsupported claim: "${token.trim()}"`);
    }
  }

  return issues;
}

// ─── PNG Output Validation (Gemini provider) ────────────────────────────────

/** Magic bytes for PNG images. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const MAX_PNG_BYTES = 8 * 1024 * 1024; // 8MB

/**
 * Validates raster PNG output (from the Gemini provider). Checks signature,
 * size floor and size ceiling. Throws ImageValidationError on failure so the
 * provider can fall back to the SVG pipeline.
 */
export function validatePngOutput(bytes: Uint8Array): Uint8Array {
  if (!bytes || bytes.byteLength < PNG_SIGNATURE.length) {
    throw new ImageValidationError("PNG output is too small", "IMAGE_INVALID_OUTPUT");
  }
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new ImageValidationError("Output is not a valid PNG", "IMAGE_INVALID_OUTPUT");
    }
  }
  if (bytes.byteLength > MAX_PNG_BYTES) {
    throw new ImageValidationError("PNG output exceeds 8MB limit", "IMAGE_INVALID_OUTPUT");
  }
  return bytes;
}

// ─── Image Validation Error ─────────────────────────────────────────────────

export class ImageValidationError extends AppError {
  constructor(message: string, code: "IMAGE_INVALID_INPUT" | "IMAGE_INVALID_OUTPUT") {
    super(message, { code });
    this.name = "ImageValidationError";
  }
}
