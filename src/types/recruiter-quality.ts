// ─── Recruiter Post Quality — Domain Types (Phase 5D) ─────────────────────────
// Deterministic post-quality evaluation layered on top of the Phase 5A–5C
// pipeline. The evaluator is PURE and deterministic: no LLM, no randomness,
// no chain-of-thought. Identical (post, context) inputs always produce identical
// reports.
//
// Anti-hallucination contract (carried from Phase 5A/5B, never weakened):
//   - A post can never be recommended for approval when it contains an
//     unsupported personal achievement claim (quality score never overrides
//     evidence safety).
//   - `USER_CONFIRMED` evidence is the only thing that can support first-person
//     "I built / I solved / I deployed" claims.
//   - Learning framed around `SUPPORTED_BY_PDF` / `INFERRED_FROM_STRUCTURE`
//     evidence never becomes personal achievement.

export type RecruiterQualityDimension =
  | "recruiterRelevance"
  | "evidenceStrength"
  | "technicalDepth"
  | "practicalExperience"
  | "problemSolving"
  | "clarity"
  | "authenticity"
  | "learningGrowth";

export const RECRUITER_QUALITY_DIMENSIONS: readonly RecruiterQualityDimension[] = [
  "recruiterRelevance",
  "evidenceStrength",
  "technicalDepth",
  "practicalExperience",
  "problemSolving",
  "clarity",
  "authenticity",
  "learningGrowth",
] as const;

export type PublishRecommendation =
  | "strong"
  | "ready"
  | "needs_review"
  | "do_not_publish";

/**
 * Full evaluation of a single generated post. Every dimension is 0–100;
 * `totalScore` is the dimension-weight blend of those eight.
 */
export type RecruiterQualityResult = {
  readonly totalScore: number;
  readonly dimensions: Record<RecruiterQualityDimension, number>;
  /** Pre-authored, deterministic strengths of the post (no inference). */
  readonly strengths: readonly string[];
  /** Pre-authored, deterministic suggestions to improve the post. */
  readonly improvements: readonly string[];
  /**
   * Deterministic flags. A `[critical]` warning means the post must NOT be
   * approved even if its score is high. Warnings are concise and intentionally
   * contain no chain-of-thought or raw model reasoning.
   */
  readonly warnings: readonly string[];
  readonly hasCriticalWarning: boolean;
  readonly publishRecommendation: PublishRecommendation;
};

/**
 * The safe, persistable shape of an evaluation. This is what the UI receives
 * and what is stored on `generated_posts.recruiter_quality_report`. It never
 * contains raw prompts, evidence text dumps, or hidden reasoning.
 */
export type RecruiterQualityReport = {
  readonly score: number;
  readonly recommendation: PublishRecommendation;
  readonly dimensions: Record<RecruiterQualityDimension, number>;
  readonly strengths: readonly string[];
  readonly improvements: readonly string[];
  readonly warnings: readonly string[];
  readonly evaluatedAt: string;
};

/**
 * Deterministic content brief injected into the generation input so the AI
 * writes toward the selected opportunity's recruiter signal while never
 * exceeding the supplied evidence. Built from the generation context — no new
 * evidence is ever created here.
 */
export type RecruiterContentBrief = {
  readonly primaryGoal: string;
  readonly recruiterSignal: string;
  readonly strongestEvidence: string;
  readonly technicalFocus: string;
  readonly practicalFocus: string | null;
  readonly problemSolvingFocus: string | null;
  readonly growthFocus: string | null;
  readonly forbiddenClaims: readonly string[];
};