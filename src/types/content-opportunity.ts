// ─── Content Opportunity — Domain Types ──────────────────────────────────────
// Phase 5A — recruiter-focused content taxonomy.
//
// The taxonomy is the strongly typed contract for the whole recruiter-content
// system: post types, content goals, scoring dimensions, and the content
// opportunity record that Phase 5B will produce from confirmed evidence.
//
// ANTI-HALLUCINATION CONTRACT (kept from the existing evidence model):
// - Personal-experience post types (built / debugged / deployed / solved)
//   may only be generated from `USER_CONFIRMED` evidence.
// - Course material alone (`SUPPORTED_BY_PDF` / `INFERRED_FROM_STRUCTURE`)
//   never becomes a personal claim; it may only support learning content.
// - Missing evidence never increases any score.

import type { EvidenceType } from "./course-material";
import type { PostFormat } from "./ai";

// ─── Post Taxonomy ───────────────────────────────────────────────────────────

export type PostType =
  | "PROJECT_SHOWCASE"
  | "PROBLEM_SOLUTION"
  | "DEBUGGING_STORY"
  | "TECHNICAL_LESSON"
  | "SECURITY_LESSON"
  | "DEPLOYMENT_STORY"
  | "API_INTEGRATION"
  | "DATABASE_ENGINEERING"
  | "AI_ENGINEERING"
  | "LEARNING_MILESTONE"
  | "ENGINEERING_DECISION"
  | "CAREER_PROGRESS";

export const POST_TYPES: readonly PostType[] = [
  "PROJECT_SHOWCASE",
  "PROBLEM_SOLUTION",
  "DEBUGGING_STORY",
  "TECHNICAL_LESSON",
  "SECURITY_LESSON",
  "DEPLOYMENT_STORY",
  "API_INTEGRATION",
  "DATABASE_ENGINEERING",
  "AI_ENGINEERING",
  "LEARNING_MILESTONE",
  "ENGINEERING_DECISION",
  "CAREER_PROGRESS",
] as const;

/** Broad bucket used for the content-mix breakdown in the dashboard. */
export type PostTypeCategory = "build" | "solve" | "learn" | "career";

// ─── Content Goals ───────────────────────────────────────────────────────────

export type ContentGoal =
  | "GET_RECRUITER_ATTENTION"
  | "BUILD_TECHNICAL_CREDIBILITY"
  | "SHOW_PROJECTS"
  | "SHOW_PROBLEM_SOLVING"
  | "DOCUMENT_LEARNING"
  | "BALANCED";

export const CONTENT_GOALS: readonly ContentGoal[] = [
  "GET_RECRUITER_ATTENTION",
  "BUILD_TECHNICAL_CREDIBILITY",
  "SHOW_PROJECTS",
  "SHOW_PROBLEM_SOLVING",
  "DOCUMENT_LEARNING",
  "BALANCED",
] as const;

export const DEFAULT_CONTENT_GOAL: ContentGoal = "GET_RECRUITER_ATTENTION";

// ─── Opportunity Lifecycle ───────────────────────────────────────────────────

export type ContentOpportunityStatus =
  | "candidate"
  | "selected"
  | "generated"
  | "approved"
  | "published"
  | "rejected";

export type ContentOpportunitySourceKind =
  | "course-material"
  | "journal"
  | "project-evidence";

// ─── Scoring ─────────────────────────────────────────────────────────────────

export type RecruiterDimension =
  | "realImplementationEvidence"
  | "problemSolvingEvidence"
  | "technicalDepth"
  | "productionDeploymentRelevance"
  | "securityEngineeringQuality"
  | "multipleSkills"
  | "communicationTeachingValue"
  | "uniqueness";

export const RECRUITER_DIMENSIONS: readonly RecruiterDimension[] = [
  "realImplementationEvidence",
  "problemSolvingEvidence",
  "technicalDepth",
  "productionDeploymentRelevance",
  "securityEngineeringQuality",
  "multipleSkills",
  "communicationTeachingValue",
  "uniqueness",
] as const;

/**
 * Deterministic signal for one scoring dimension. `present` marks whether the
 * content-opportunity layer found any evidence for the dimension at all;
 * `confidence` is the strength of that evidence (existing EvidenceType).
 */
export type DimensionEvidence = {
  readonly present: boolean;
  readonly confidence: EvidenceType;
};

export type OpportunityDimensions = Record<RecruiterDimension, DimensionEvidence>;

/**
 * Everything the deterministic scoring service needs, without any reliance on
 * an LLM. Produced by the content-opportunity layer (Phase 5B) from confirmed
 * journal/course-material evidence.
 */
export type OpportunityScoringInput = {
  readonly id: string;
  readonly postType: PostType;
  readonly topic: string;
  readonly summary: string;
  /** Strength of the evidence backing the opportunity's core claim. */
  readonly evidenceStrength: EvidenceType;
  readonly dimensions: OpportunityDimensions;
  /** Distinct skill/topic codes demonstrated (feeds multipleSkills/diversity). */
  readonly skillCodes: readonly string[];
  readonly recentPostTypes: readonly PostType[];
  readonly recentTopics: readonly string[];
};

export type RecruiterScore = {
  /** 0–100, capped. */
  readonly total: number;
  /** Per-dimension earned points (0..weight). */
  readonly dimensions: Record<RecruiterDimension, number>;
  /** Passes authenticity + evidence gates and meets the recommendation threshold. */
  readonly eligible: boolean;
  readonly authenticityFlags: readonly string[];
};

export type ScoredOpportunity = OpportunityScoringInput & {
  readonly score: RecruiterScore;
};

export type SelectionRecommendation = {
  readonly opportunity: ScoredOpportunity;
  /** Concise public explanation. Deliberately NOT chain-of-thought. */
  readonly reason: string;
  /** True when recent-post diversity reduced this opportunity's score. */
  readonly diversityAdjusted: boolean;
};

// ─── Content Opportunity Record (domain shape) ───────────────────────────────
// The Phase 5B migration will persist this; the domain type is defined here so
// the taxonomy is the single source of truth.

export type ContentOpportunityEvidenceReference = {
  readonly field: string;
  readonly pageNumbers: readonly number[];
  readonly confidence: EvidenceType;
};

export type ContentOpportunity = {
  readonly id: string;
  readonly profileId: string;
  readonly sourceDocumentId: string | null;
  readonly sourceDayNumber: number | null;
  readonly sourceKind: ContentOpportunitySourceKind;
  readonly postType: PostType;
  readonly title: string;
  readonly summary: string;
  readonly evidenceReferences: readonly ContentOpportunityEvidenceReference[];
  readonly evidenceStrength: EvidenceType;
  readonly score: RecruiterScore | null;
  readonly recommendedFormat: PostFormat | null;
  readonly status: ContentOpportunityStatus;
};

// ─── Persistence Row & Inputs (Phase 5B) ─────────────────────────────────────

/** Database row for the `content_opportunities` table. */
export type ContentOpportunityRow = {
  id: string;
  profile_id: string;
  source_type: ContentOpportunitySourceKind;
  source_id: string | null;
  day_number: number | null;
  module_number: number | null;
  post_type: PostType;
  content_goal: ContentGoal;
  title: string;
  summary: string | null;
  evidence: ContentOpportunityEvidenceReference[];
  recruiter_score: number;
  recruiter_score_breakdown: RecruiterScore | null;
  selection_reason: string | null;
  status: ContentOpportunityStatus;
  dedup_key: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateContentOpportunityInput = {
  readonly source_type: ContentOpportunitySourceKind;
  readonly source_id: string | null;
  readonly day_number: number | null;
  readonly module_number: number | null;
  readonly post_type: PostType;
  readonly content_goal: ContentGoal;
  readonly title: string;
  readonly summary: string | null;
  readonly evidence: readonly ContentOpportunityEvidenceReference[];
  readonly recruiter_score: number;
  readonly recruiter_score_breakdown: RecruiterScore | null;
  readonly selection_reason: string | null;
  readonly status?: ContentOpportunityStatus;
  readonly dedup_key?: string;
};

export type UpdateContentOpportunityInput = {
  readonly status?: ContentOpportunityStatus;
  readonly selection_reason?: string | null;
};

export const ALLOWED_OPPORTUNITY_STATUS_TRANSITIONS: Record<
  ContentOpportunityStatus,
  readonly ContentOpportunityStatus[]
> = {
  candidate: ["selected", "generated", "rejected"],
  selected: ["generated", "rejected"],
  generated: ["approved", "rejected"],
  approved: ["published"],
  published: [],
  rejected: [],
};