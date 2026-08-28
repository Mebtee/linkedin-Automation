// ─── Recruiter Relevance Scoring ─────────────────────────────────────────────
// Phase 5A — deterministic, LLM-free scoring of content opportunities.
//
// Scoring contract:
// - Personal-experience dimensions (built / solved / deployed / secured) only
//   earn points from USER_CONFIRMED evidence; SUPPORTED_BY_PDF counts as a
//   small traced fraction, and MISSING/INFERRED never count as personal work.
// - Knowledge dimensions (depth, communication) accept USER_CONFIRMED and
//   SUPPORTED_BY_PDF fully; INFERRED counts partially for learning content.
// - Scores are a pure function of their input: no randomness, stable ties.
// - The total is capped at 100.

import type { EvidenceType } from "@/types/course-material";
import type {
  ContentGoal,
  OpportunityScoringInput,
  RecruiterDimension,
  RecruiterScore,
  ScoredOpportunity,
  SelectionRecommendation,
} from "@/types/content-opportunity";
import { DEFAULT_CONTENT_GOAL, RECRUITER_DIMENSIONS } from "@/types/content-opportunity";
import { POST_TYPE_META, recruiter } from "@/config/recruiter";

type DimensionKind = "personal" | "knowledge";

const PERSONAL_DIMENSIONS: ReadonlySet<RecruiterDimension> = new Set([
  "realImplementationEvidence",
  "problemSolvingEvidence",
  "productionDeploymentRelevance",
  "securityEngineeringQuality",
]);

const CONFIDENCE_FACTORS: Record<EvidenceType, { personal: number; knowledge: number }> = {
  USER_CONFIRMED: { personal: 1, knowledge: 1 },
  SUPPORTED_BY_PDF: { personal: 0.35, knowledge: 1 },
  INFERRED_FROM_STRUCTURE: { personal: 0, knowledge: 0.25 },
  MISSING: { personal: 0, knowledge: 0 },
};

function confidenceFactor(confidence: EvidenceType, kind: DimensionKind): number {
  return CONFIDENCE_FACTORS[confidence][kind];
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Uniqueness is computed purely from recent-post history (diversity, §8). */
function uniquenessFactor(input: OpportunityScoringInput): number {
  const repeatCount = input.recentPostTypes.filter((t) => t === input.postType).length;
  const topicOverlap = input.recentTopics.some((t) => {
    if (!t || !input.topic) return false;
    const a = t.toLowerCase();
    const b = input.topic.toLowerCase();
    return a === b || a.includes(b) || b.includes(a);
  });
  const penalty = 0.25 * Math.min(repeatCount, 4) + (topicOverlap ? 0.15 : 0);
  return Math.max(0, 1 - penalty);
}

/** multipleSkills rewards demonstrated breadth; more distinct skills, more credit. */
function multipleSkillsFactor(input: OpportunityScoringInput): number {
  if (!input.dimensions.multipleSkills.present) return 0;
  const uniqueSkills = new Set(input.skillCodes.map((s) => s.toLowerCase())).size;
  if (uniqueSkills === 0) return 0;
  const countFactor = Math.min(uniqueSkills, 5) / 5;
  const cf = confidenceFactor(input.dimensions.multipleSkills.confidence, "knowledge");
  return countFactor * cf;
}

function dimensionFactor(input: OpportunityScoringInput, dimension: RecruiterDimension): number {
  if (dimension === "uniqueness") return uniquenessFactor(input);
  if (dimension === "multipleSkills") return multipleSkillsFactor(input);

  const evidence = input.dimensions[dimension];
  if (!evidence.present) return 0;
  const kind: DimensionKind = PERSONAL_DIMENSIONS.has(dimension) ? "personal" : "knowledge";
  return clamp(confidenceFactor(evidence.confidence, kind));
}

function computeAuthenticityFlags(
  input: OpportunityScoringInput,
  total: number,
): { readonly eligible: boolean; readonly flags: readonly string[] } {
  const meta = POST_TYPE_META[input.postType];
  const flags: string[] = [];

  if (input.evidenceStrength === "MISSING") {
    flags.push("No evidence supports this opportunity.");
  } else if (meta.personalExperience && input.evidenceStrength !== "USER_CONFIRMED") {
    flags.push(
      "This post type claims personal engineering work and requires confirmed evidence before it can be generated.",
    );
  }

  if (flags.length === 0 && total < recruiter.minRecommendScore) {
    flags.push("Score is below the recommendation threshold.");
  }

  return { eligible: flags.length === 0, flags };
}

/**
 * Computes the deterministic recruiter relevance score for one opportunity.
 * The same input always produces the same score.
 */
export function computeRecruiterScore(
  input: OpportunityScoringInput,
  options: { readonly goal?: ContentGoal } = {},
): RecruiterScore {
  const goal = options.goal ?? DEFAULT_CONTENT_GOAL;
  const multipliers = recruiter.goalWeightMultipliers[goal];

  const dimensions = {} as Record<RecruiterDimension, number>;
  let rawTotal = 0;

  for (const dimension of RECRUITER_DIMENSIONS) {
    const factor = dimensionFactor(input, dimension);
    const earned = recruiter.weights[dimension] * factor * multipliers[dimension];
    dimensions[dimension] = Number(earned.toFixed(2));
    rawTotal += earned;
  }

  const total = Math.min(100, Math.round(rawTotal));
  const { eligible, flags } = computeAuthenticityFlags(input, total);

  return { total, dimensions, eligible, authenticityFlags: flags };
}

/** Scores every input in order and returns them paired with their score. */
export function scoreOpportunities(
  inputs: readonly OpportunityScoringInput[],
  options: { readonly goal?: ContentGoal } = {},
): ScoredOpportunity[] {
  return inputs.map((input) => ({ ...input, score: computeRecruiterScore(input, options) }));
}

const DIMENSION_PHRASES: Record<RecruiterDimension, string> = {
  realImplementationEvidence: "real implementation evidence",
  problemSolvingEvidence: "problem-solving evidence",
  technicalDepth: "technical depth",
  productionDeploymentRelevance: "relevant deployment and production experience",
  securityEngineeringQuality: "security and engineering quality",
  multipleSkills: "multiple engineering skills",
  communicationTeachingValue: "a clear way to explain technical work",
  uniqueness: "a fresh topic compared with recent posts",
};

/**
 * Public explanation of a recommendation. Concise and factual — deliberately
 * not chain-of-thought; only completed dimensions are referenced.
 */
function buildRecommendationReason(opportunity: ScoredOpportunity): string {
  const parts: string[] = [];
  for (const dimension of RECRUITER_DIMENSIONS) {
    if (opportunity.score.dimensions[dimension] >= recruiter.weights[dimension] * 0.6) {
      parts.push(DIMENSION_PHRASES[dimension]);
    }
    if (parts.length === 3) break;
  }
  if (parts.length === 0) {
    return "Recommended because it is the strongest available evidence-backed opportunity.";
  }
  return `Recommended because this demonstrates ${parts.join(", ")}.`;
}

/**
 * Selects the strongest eligible opportunity. Applies the authenticity gates
 * and recommendation threshold, then the diversity-aware score; ties resolve
 * to the earliest input (deterministic).
 */
export function selectStrongestOpportunity(
  scored: readonly ScoredOpportunity[],
): SelectionRecommendation | null {
  const eligible = scored.filter((o) => o.score.eligible);
  if (eligible.length === 0) return null;

  let best: ScoredOpportunity = eligible[0]!;
  for (let i = 1; i < eligible.length; i++) {
    if (eligible[i]!.score.total > best.score.total) best = eligible[i]!;
  }

  return {
    opportunity: best,
    reason: buildRecommendationReason(best),
    diversityAdjusted: best.score.dimensions.uniqueness < recruiter.weights.uniqueness,
  };
}