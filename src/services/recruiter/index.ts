// ─── Recruiter Content Orchestration (Phase 5B) ──────────────────────────────
// Entry points that convert confirmed journal / course-material evidence into
// persisted, scored content opportunities.
//
// Pipeline (all deterministic, zero LLM):
//   evidence → buildContentOpportunities → scoreDrafts (Phase 5A scoring)
//           → createContentOpportunities (idempotent upsert by dedup_key)
//
// Anti-hallucination: the journal path is `confirmed=true` only when the user
// submitted the entry; the course-material path is always `confirmed=false`
// (AI-proposed evidence may support learning content, never personal claims).

import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/utils/errors";
import type { JournalContext } from "@/types/ai";
import type { EvidenceType } from "@/types/course-material";
import type {
  ContentGoal,
  ContentOpportunityEvidenceReference,
  ContentOpportunityRow,
  DimensionEvidence,
  OpportunityDimensions,
  OpportunityScoringInput,
  RecruiterDimension,
  ScoredOpportunity,
} from "@/types/content-opportunity";
import { DEFAULT_CONTENT_GOAL, RECRUITER_DIMENSIONS } from "@/types/content-opportunity";
import type { JournalEntry } from "@/types/journal";
import { getOwnCourseMaterial } from "../course-materials";
import { buildContentOpportunities, scoreDrafts } from "./opportunities";
import type { ContentOpportunityDraft, OpportunityBuilderInput } from "./opportunities";
import { createContentOpportunities } from "./persistence";
import { selectStrongestOpportunity } from "./scoring";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const CONFIRMED_JOURNAL_STATUSES = new Set(["submitted", "used"]);

const EMPTY_DIMENSIONS: OpportunityDimensions = Object.fromEntries(
  RECRUITER_DIMENSIONS.map((dimension) => [
    dimension,
    { present: false, confidence: "MISSING" } satisfies DimensionEvidence,
  ]),
) as OpportunityDimensions;

async function requireAuth(supabase: SupabaseClient): Promise<{ id: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("Authentication required.", { code: "AUTH_REQUIRED" });
  }

  return user;
}

// ─── Row → Context Mappers ───────────────────────────────────────────────────

/** Maps the submitted journal row into the camelCase AI/journal shape. */
function journalRowToContext(entry: JournalEntry): JournalContext {
  return {
    whatILearned: entry.what_i_learned,
    whatIPracticed: entry.what_i_practiced,
    whatIBuilt: entry.what_i_built,
    challenge: entry.challenge,
    howISolvedIt: entry.how_i_solved_it,
    keyTakeaway: entry.key_takeaway,
    tomorrowFocus: entry.tomorrow_focus,
    projectName: entry.project_name,
    projectDescription: entry.project_description,
    codeReference: entry.code_reference,
    resourcesUsed: entry.resources_used,
    confidenceLevel: entry.confidence_level,
    additionalNotes: entry.additional_notes,
  };
}

function strongestReference(
  references: readonly ContentOpportunityEvidenceReference[],
): { confidence: EvidenceType } {
  let best: EvidenceType = "MISSING";
  for (const ref of references) {
    if (CONFIDENCE_ORDER[ref.confidence] > CONFIDENCE_ORDER[best]) best = ref.confidence;
  }
  return { confidence: best };
}

const CONFIDENCE_ORDER: Record<EvidenceType, number> = {
  USER_CONFIRMED: 4,
  SUPPORTED_BY_PDF: 3,
  INFERRED_FROM_STRUCTURE: 2,
  MISSING: 1,
};

/**
 * Reconstructs a ScoredOpportunity from a stored row so Phase 5A's
 * `selectStrongestOpportunity` can rank rows using their STORED deterministic
 * scores. Nothing is re-scored here — only `score` is read downstream.
 */
function rowToScored(row: ContentOpportunityRow): ScoredOpportunity {
  const { confidence } = strongestReference(row.evidence);
  const stored = row.recruiter_score_breakdown;
  const score = stored ?? {
    total: Math.round(Number(row.recruiter_score) || 0),
    dimensions: Object.fromEntries(
      RECRUITER_DIMENSIONS.map((dimension) => [dimension, 0]),
    ) as Record<RecruiterDimension, number>,
    eligible: false,
    authenticityFlags: ["No stored score breakdown."],
  };

  const input: OpportunityScoringInput = {
    id: row.id,
    postType: row.post_type,
    topic: row.title,
    summary: row.summary ?? "",
    evidenceStrength: confidence,
    dimensions: EMPTY_DIMENSIONS,
    skillCodes: [],
    recentPostTypes: [],
    recentTopics: [],
  };

  return { ...input, score };
}

// ─── Draft → Create Input ────────────────────────────────────────────────────

function draftToCreateInput(
  draft: ContentOpportunityDraft,
  scored: ScoredOpportunity,
  source: {
    readonly profileId: string;
    readonly sourceType: ContentOpportunityRow["source_type"];
    readonly sourceId: string | null;
    readonly dayNumber: number | null;
    readonly moduleNumber: number | null;
    readonly contentGoal: ContentGoal;
  },
): Parameters<typeof createContentOpportunities>[0][number] {
  return {
    source_type: source.sourceType,
    source_id: source.sourceId,
    day_number: source.dayNumber,
    module_number: source.moduleNumber,
    post_type: draft.postType,
    content_goal: source.contentGoal,
    title: draft.title,
    summary: draft.summary,
    evidence: [...draft.evidenceReferences],
    recruiter_score: scored.score.total,
    recruiter_score_breakdown: scored.score,
    selection_reason: null,
    status: "candidate",
    dedup_key: draft.dedupKey,
  };
}

async function buildAndPersist(
  input: OpportunityBuilderInput,
  goal: ContentGoal,
): Promise<ContentOpportunityRow[]> {
  const drafts = buildContentOpportunities(input);
  if (drafts.length === 0) return [];

  const scored = scoreDrafts(drafts, input, { goal });
  const inputs = drafts.map((draft, index) => {
    const s = scored[index]!;
    return draftToCreateInput(draft, s, {
      profileId: input.profileId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      dayNumber: input.dayNumber,
      moduleNumber: input.moduleNumber,
      contentGoal: goal,
    });
  });

  return createContentOpportunities(inputs);
}

// ─── Journal Entry Point ─────────────────────────────────────────────────────

/**
 * Generates content opportunities from the user's journal entry for a day.
 * Confirmed = the entry was submitted (`submitted` / `used`).
 */
export async function generateContentOpportunitiesForDay(
  options: { readonly dayNumber: number; readonly goal?: ContentGoal },
): Promise<ContentOpportunityRow[]> {
  const supabase = await createClient();
  const user = await requireAuth(supabase);

  const dayNumber = Number(options.dayNumber);
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 105) {
    throw new AppError("day_number must be between 1 and 105.", {
      code: "VALIDATION_ERROR",
    });
  }
  const goal = options.goal ?? DEFAULT_CONTENT_GOAL;

  const { data: entry, error: entryError } = await supabase
    .from("daily_learning_entries")
    .select("*")
    .eq("profile_id", user.id)
    .eq("day_number", dayNumber)
    .single();

  if (entryError || !entry) {
    throw new AppError("Journal entry not found for this day.", {
      code: "JOURNAL_NOT_FOUND",
    });
  }

  const { data: curriculum } = await supabase
    .from("curriculum_days")
    .select("topic, module_id")
    .eq("day_number", dayNumber)
    .single();

  const confirmed = CONFIRMED_JOURNAL_STATUSES.has(entry.status);

  const builderInput: OpportunityBuilderInput = {
    profileId: user.id,
    sourceType: "journal",
    sourceId: entry.id as string,
    dayNumber,
    moduleNumber: null,
    topic: curriculum?.topic ?? null,
    moduleTitle: null,
    journal: journalRowToContext(entry as JournalEntry),
    confirmed,
    evidence: undefined,
    curriculum: null,
    recentPostTypes: undefined,
    recentTopics: undefined,
  };

  return buildAndPersist(builderInput, goal);
}

// ─── Course Material Entry Point ─────────────────────────────────────────────

export type GenerateForCourseMaterialInput = {
  readonly courseMaterialId: string;
  readonly goal?: ContentGoal;
};

/**
 * Generates content opportunities from an uploaded course material's journal
 * proposal. Always unconfirmed → learning opportunities only; AI-proposed
 * personal claims are never converted into personal-experience posts.
 */
export async function generateContentOpportunitiesForCourseMaterial(
  options: GenerateForCourseMaterialInput,
): Promise<ContentOpportunityRow[]> {
  const material = await getOwnCourseMaterial(options.courseMaterialId);
  if (!material) {
    throw new AppError("Course material not found.", {
      code: "COURSE_MATERIAL_NOT_FOUND",
    });
  }
  const proposal = material.journal_proposal;

  if (!proposal) {
    throw new AppError("This course material has no journal proposal yet.", {
      code: "PROPOSAL_NOT_READY",
    });
  }

  const goal = options.goal ?? DEFAULT_CONTENT_GOAL;

  const builderInput: OpportunityBuilderInput = {
    profileId: material.profile_id,
    sourceType: "course-material",
    sourceId: material.id,
    dayNumber: proposal.curriculumDay,
    moduleNumber: proposal.moduleNumber,
    topic: proposal.topic,
    moduleTitle: proposal.moduleTitle,
    journal: proposal.journal,
    confirmed: false,
    evidence: proposal.evidence,
    curriculum: null,
    recentPostTypes: undefined,
    recentTopics: undefined,
  };

  return buildAndPersist(builderInput, goal);
}

// ─── Best Opportunity Selection ──────────────────────────────────────────────

export type BestOpportunityResult = {
  readonly row: ContentOpportunityRow;
  readonly reason: string;
  readonly diversityAdjusted: boolean;
};

/**
 * Selects the strongest eligible candidate using Phase 5A's
 * `selectStrongestOpportunity` over stored deterministic scores. The winner is
 * advanced to `selected` with a concise public `selection_reason`.
 */
export async function selectBestContentOpportunity(): Promise<BestOpportunityResult | null> {
  const supabase = await createClient();
  const user = await requireAuth(supabase);

  const { data, error } = await supabase
    .from("content_opportunities")
    .select("*")
    .eq("profile_id", user.id)
    .in("status", ["candidate", "selected"])
    .order("recruiter_score", { ascending: false })
    .limit(100);

  if (error) {
    throw new AppError("Failed to fetch content opportunities.", {
      code: "DATABASE_ERROR",
      cause: error,
    });
  }

  const rows = (data ?? []) as ContentOpportunityRow[];
  if (rows.length === 0) return null;

  const scored = rows.map(rowToScored);
  const recommendation = selectStrongestOpportunity(scored);
  if (!recommendation) return null;

  const winner = rows.find((row) => row.id === recommendation.opportunity.id) ?? rows[0]!;

  if (winner.status !== "selected") {
    const { error: updateError } = await supabase
      .from("content_opportunities")
      .update({
        status: "selected",
        selection_reason: recommendation.reason,
      })
      .eq("id", winner.id)
      .eq("profile_id", user.id);

    if (updateError) {
      throw new AppError("Failed to mark the selected content opportunity.", {
        code: "DATABASE_ERROR",
        cause: updateError,
      });
    }
  }

  return {
    row: { ...winner, status: "selected", selection_reason: recommendation.reason },
    reason: recommendation.reason,
    diversityAdjusted: recommendation.diversityAdjusted,
  };
}