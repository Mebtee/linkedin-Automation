import { AppError } from "@/lib/utils/errors";
import type { RecruiterPostGenerationContext } from "./content-opportunity";
import type { RecruiterContentBrief } from "./recruiter-quality";

// ─── Post Format ────────────────────────────────────────────────────────────

export type PostFormat =
  | "what-i-learned"
  | "challenge"
  | "small-win"
  | "project"
  | "concept"
  | "reflection"
  | "practical-lesson";

export const POST_FORMATS: readonly PostFormat[] = [
  "what-i-learned",
  "challenge",
  "small-win",
  "project",
  "concept",
  "reflection",
  "practical-lesson",
] as const;

// ─── Brand Voice ────────────────────────────────────────────────────────────

export interface BrandVoice {
  readonly tone: readonly string[];
  readonly avoid: readonly string[];
  readonly style: readonly string[];
}

// ─── Content Rules ──────────────────────────────────────────────────────────

export interface ContentRules {
  readonly targetWordCount: { readonly min: number; readonly max: number };
  readonly maxHashtags: number;
  readonly shortParagraphs: boolean;
  readonly avoidEmojis: boolean;
  readonly avoidComplexVocabulary: boolean;
  readonly noUnsupportedClaims: boolean;
  readonly noInventedProjectResults: boolean;
  readonly noInventedTechnologies: boolean;
  readonly noInventedProblems: boolean;
  readonly noInventedAchievements: boolean;
}

// ─── Curriculum Context (for AI) ────────────────────────────────────────────

export interface CurriculumContext {
  readonly dayNumber: number;
  readonly topic: string;
  readonly moduleNumber: number;
  readonly moduleTitle: string;
  readonly content: string;
  readonly subtopics: readonly string[];
  readonly projectInformation: string | null;
  readonly assessmentInformation: string | null;
}

// ─── Journal Context (for AI) ───────────────────────────────────────────────

export interface JournalContext {
  readonly whatILearned: string | null;
  readonly whatIPracticed: string | null;
  readonly whatIBuilt: string | null;
  readonly challenge: string | null;
  readonly howISolvedIt: string | null;
  readonly keyTakeaway: string | null;
  readonly tomorrowFocus: string | null;
  readonly projectName: string | null;
  readonly projectDescription: string | null;
  readonly codeReference: string | null;
  readonly resourcesUsed: string | null;
  readonly confidenceLevel: number | null;
  readonly additionalNotes: string | null;
}

// ─── Post Generation Input ──────────────────────────────────────────────────

export interface PostGenerationInput {
  readonly curriculum: CurriculumContext;
  readonly journal: JournalContext;
  readonly brandVoice: BrandVoice;
  readonly format: PostFormat;
  readonly rules: ContentRules;
  /**
   * Optional recruiter-focused context (Phase 5C). Present when the post is
   * generated from a selected ContentOpportunity. When present, this context
   * is the PRIMARY content direction: the provider must write about the
   * selected opportunity and may only use the supplied evidence.
   */
  readonly recruiter?: RecruiterPostGenerationContext;
  /** Deterministic content brief (Phase 5D) when the post is opportunity-backed. */
  readonly recruiterBrief?: RecruiterContentBrief;
}

// ─── Generated Post ─────────────────────────────────────────────────────────

export interface GeneratedPost {
  readonly opening: string;
  readonly body: string;
  readonly takeaway: string;
  readonly nextStep: string;
  readonly hashtags: readonly string[];
}

// ─── Image Metadata (for future image generation) ───────────────────────────

export interface ImageMetadata {
  readonly headline: string;
  readonly subheadline: string;
  readonly keywords: readonly string[];
  readonly visualConcept: string;
  readonly template: string;
}

// ─── Generated Post Payload ─────────────────────────────────────────────────

export interface GeneratedPostPayload {
  readonly post: GeneratedPost;
  readonly image: ImageMetadata;
}

// ─── Provider Metadata ──────────────────────────────────────────────────────

export interface ProviderMetadata {
  readonly provider: string;
  readonly model: string;
  readonly tokensUsed?: number;
  readonly generatedAt: string;
}

// ─── Provider Result ────────────────────────────────────────────────────────

export interface ProviderResult {
  readonly payload: GeneratedPostPayload;
  readonly metadata: ProviderMetadata;
}

// ─── AI Error ───────────────────────────────────────────────────────────────

export type AIErrorCode =
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_INPUT"
  | "INVALID_OUTPUT"
  | "RATE_LIMITED"
  | "AUTHENTICATION_ERROR"
  | "TIMEOUT"
  | "UNKNOWN";

export class AIError extends AppError {
  readonly aiCode: AIErrorCode;

  constructor(message: string, options: { code: AIErrorCode; cause?: unknown }) {
    super(message, { code: options.code, cause: options.cause });
    this.name = "AIError";
    this.aiCode = options.code;
  }
}

// ─── Provider Interface ─────────────────────────────────────────────────────

export interface TextGenerationProvider {
  generatePost(input: PostGenerationInput): Promise<ProviderResult>;
}
