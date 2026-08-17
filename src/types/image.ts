import { AppError } from "@/lib/utils/errors";

// ─── Image Template ─────────────────────────────────────────────────────────

export type ImageTemplate =
  | "large-number"
  | "code-visual"
  | "concept-diagram"
  | "project-focused"
  | "progress"
  | "final-milestone";

export const IMAGE_TEMPLATES: readonly ImageTemplate[] = [
  "large-number",
  "code-visual",
  "concept-diagram",
  "project-focused",
  "progress",
  "final-milestone",
] as const;

// ─── Image Generation Input ─────────────────────────────────────────────────

export interface ImageGenerationInput {
  readonly dayNumber: number;
  readonly topic: string;
  readonly moduleNumber: number;
  readonly moduleTitle: string;
  readonly headline: string;
  readonly subheadline: string;
  readonly keywords: readonly string[];
  readonly visualConcept: string;
  readonly template: ImageTemplate;
}

// ─── Image Provider Result ──────────────────────────────────────────────────

export interface ImageProviderResult {
  readonly svg: string;
  readonly width: number;
  readonly height: number;
  readonly template: ImageTemplate;
}

// ─── Image Generation Error ─────────────────────────────────────────────────

export type ImageGenerationErrorCode =
  | "IMAGE_PROVIDER_UNAVAILABLE"
  | "IMAGE_INVALID_INPUT"
  | "IMAGE_INVALID_OUTPUT"
  | "IMAGE_GENERATION_FAILED"
  | "IMAGE_STORAGE_FAILED"
  | "IMAGE_NOT_FOUND"
  | "IMAGE_UNAUTHORIZED";

export class ImageGenerationError extends AppError {
  readonly imageCode: ImageGenerationErrorCode;

  constructor(message: string, options: { code: ImageGenerationErrorCode; cause?: unknown }) {
    super(message, { code: options.code, cause: options.cause });
    this.name = "ImageGenerationError";
    this.imageCode = options.code;
  }
}

// ─── Image Generation Provider ──────────────────────────────────────────────

export interface ImageGenerationProvider {
  generateImage(input: ImageGenerationInput): Promise<ImageProviderResult>;
}

// ─── Media Asset ────────────────────────────────────────────────────────────

export type MediaAssetRow = {
  readonly id: string;
  readonly profile_id: string;
  readonly generated_post_id: string;
  readonly storage_path: string;
  readonly storage_url: string;
  readonly mime_type: string;
  readonly width: number;
  readonly height: number;
  readonly template: ImageTemplate;
  readonly alt_text: string;
  readonly metadata: Record<string, unknown> | null;
  readonly created_at: string;
  readonly updated_at: string;
};

// ─── Media Asset Create Input ───────────────────────────────────────────────

export type CreateMediaAssetInput = {
  readonly generated_post_id: string;
  readonly storage_path: string;
  readonly storage_url: string;
  readonly mime_type: string;
  readonly width: number;
  readonly height: number;
  readonly template: ImageTemplate;
  readonly alt_text: string;
  readonly metadata?: Record<string, unknown> | null;
};
