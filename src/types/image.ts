// ─── Image Template ─────────────────────────────────────────────────────────

export type ImageTemplate =
  | "large-number"
  | "code-visual"
  | "concept-diagram"
  | "project-focused"
  | "progress"
  | "final-milestone"
  | "gemini-image";

export const IMAGE_TEMPLATES: readonly ImageTemplate[] = [
  "large-number",
  "code-visual",
  "concept-diagram",
  "project-focused",
  "progress",
  "final-milestone",
  "gemini-image",
] as const;

// ─── Visual Theme & Composition (Phase 5G) ───────────────────────────────────
// Determines the visual story the image tells. Theme + composition are selected
// deterministically from the post — identical input always yields the same
// visual, while different posts naturally produce different compositions.

export type VisualTheme =
  | "learning-concept"
  | "project-build"
  | "problem-solving"
  | "technical-explanation"
  | "security"
  | "career-growth"
  | "reflection"
  | "achievement";

export type VisualComposition =
  | "concept-flow"
  | "problem-solution"
  | "three-ideas"
  | "architecture-flow"
  | "before-after"
  | "skill-progression"
  | "comparison"
  | "input-process-output";

/**
 * Recruiter-aware visual emphasis (Phase 5H). Derived only from supported
 * signals — the post type and structure — and NEVER exposes an internal quality
 * score, dimension detail, or hidden reasoning inside the image. It only steers
 * which layout emphasizes what (problem→diagnosis→solution, architecture, etc.).
 */
export type RecruiterEmphasis =
  | "problem-solve"
  | "architecture"
  | "concept-explanation"
  | "security-flow"
  | "simple";

export const RECRUITER_EMPHASES: readonly RecruiterEmphasis[] = [
  "problem-solve",
  "architecture",
  "concept-explanation",
  "security-flow",
  "simple",
] as const;


/**
 * Structured, evidence-safe description of what the image should communicate.
 * Built deterministically from the post; never contains internal prompts,
 * confidence values, chain-of-thought, or unsupported personal claims.
 */
export interface VisualKeyPoint {
  readonly label: string;
  readonly detail: string;
}

export interface VisualBrief {
  /** Short, headline-style summary of the post subject. */
  readonly headline: string;
  /** Secondary clarifying line, when available. */
  readonly subheadline: string;
  /** The core idea of the post. */
  readonly concept: string;
  /** Human-readable metaphor used by the composition renderer. */
  readonly visualMetaphor: string;
  /** 2–4 concise supporting points (evidence-safe). */
  readonly keyPoints: readonly VisualKeyPoint[];
  /** Technologies/tools named by the post (evidence-safe). */
  readonly technologies: readonly string[];
  /** Optional recruiter-relevant dimension, never fabricated. */
  readonly recruiterSignal?: string;
  /** Post type when known (Phase 5A taxonomy). */
  readonly postType?: string;
  /** Day of the journey when known. */
  readonly dayNumber?: number;
  /** Module label when known. */
  readonly module?: string;
  /** Deterministic visual theme. */
  readonly theme: VisualTheme;
  /** Deterministic composition chosen from the theme/post type. */
  readonly composition: VisualComposition;

  // ─── Phase 5H structured concept priority (optional for back-compat) ───────
  /** The single dominant idea the visual must lead with. */
  readonly primaryConcept?: string;
  /** 2–4 supporting concepts that reinforce the primary idea. */
  readonly secondaryConcepts?: readonly string[];
  /** Optional contextual concepts that must NOT compete with the primary. */
  readonly optionalContext?: readonly string[];
  /** Recruiter-aware emphasis hint (never exposes an internal score). */
  readonly emphasis?: RecruiterEmphasis;
  /** Post format (Phase 3B journal-content taxonomy) when known. */
  readonly postFormat?: string;
  /**
   * 3–4 concise editorial takeaways derived deterministically from the post's
   * own content (Phase 5J). Drives the navy "KEY TAKEAWAYS" panel. Never
   * invented; empty for thin/empty posts (panel skipped).
   */
  readonly keyTakeaways?: readonly string[];
}

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
  /**
   * Optional concise editorial takeaways (Phase 5J) used by the classic template
   * path for the navy "KEY TAKEAWAYS" panel. When omitted, templates derive them
   * deterministically from the flat input fields.
   */
  readonly takeaways?: readonly string[];
  /**
   * Optional structured visual brief (Phase 5G). When present, the provider
   * prefers the content-driven composition renderer; otherwise it falls back
   * to the classic template renderer. The brief is always built deterministically
   * from verified post information.
   */
  readonly visualBrief?: VisualBrief | null;
}

// ─── Image Provider Result ──────────────────────────────────────────────────

export interface ImageProviderResult {
  /** SVG output (used by the brand provider and the gifted fallback path). */
  readonly svg?: string;
  /** Raster output — final PNG bytes (used by the Gemini provider). */
  readonly png?: Uint8Array;
  /** MIME type of the produced image: "image/svg+xml" or "image/png". */
  readonly mimeType: string;
  readonly width: number;
  readonly height: number;
  readonly template: ImageTemplate;
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
