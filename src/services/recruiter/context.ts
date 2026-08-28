// ─── Recruiter Post Generation Context (Phase 5C refactor for 5D) ────────────
// Pure, deterministic context build helpers shared by the generation adapter
// (src/services/recruiter/generation.ts) and the post-quality service
// (src/services/recruiter/quality-service.ts). No imports of other recruiter
// services — this module is the shared leaf for the two pipelines, which keeps
// the dependency graph acyclic.

import type { JournalContext, PostFormat } from "@/types/ai";
import type {
  ContentOpportunityRow,
  RecruiterEvidenceEntry,
  RecruiterPostGenerationContext,
} from "@/types/content-opportunity";
import type { EvidenceType } from "@/types/course-material";
import type { JournalEntry } from "@/types/journal";
import { POST_TYPE_META } from "@/config/recruiter";

export const CONFIDENCE_ORDER: Record<EvidenceType, number> = {
  USER_CONFIRMED: 4,
  SUPPORTED_BY_PDF: 3,
  INFERRED_FROM_STRUCTURE: 2,
  MISSING: 1,
};

/** Maps a submitted journal row into the camelCase AI/journal shape. */
export function journalRowToContext(entry: JournalEntry): JournalContext {
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

export function strongestConfidence(
  entries: readonly { readonly confidence: EvidenceType }[],
): EvidenceType {
  let best: EvidenceType = "MISSING";
  for (const entry of entries) {
    if (CONFIDENCE_ORDER[entry.confidence] > CONFIDENCE_ORDER[best]) best = entry.confidence;
  }
  return best;
}

/**
 * Builds the recruiter-aware generation/evaluation context for an opportunity.
 *
 * The context carries:
 *   - the opportunity's primary content direction (postType / title / summary),
 *   - its deterministic score and the public selection reason,
 *   - the enriched evidence (exact ground-truth text per field + confidence).
 *
 * It is pure: no database, no AI. Identical inputs produce identical contexts.
 */
export function buildRecruiterPostGenerationContext(
  opportunity: ContentOpportunityRow,
  journal: JournalContext,
  format: PostFormat,
  options: { readonly topic?: string } = {},
): RecruiterPostGenerationContext {
  const evidence: RecruiterEvidenceEntry[] = (opportunity.evidence ?? []).map((reference) => {
    const raw = journal[reference.field as keyof JournalContext];
    const value = typeof raw === "string" && raw.trim() !== "" ? raw : null;
    return {
      field: reference.field,
      value,
      confidence: reference.confidence,
      pageNumbers: [...reference.pageNumbers],
    };
  });

  return {
    opportunityId: opportunity.id,
    postType: opportunity.post_type,
    contentGoal: opportunity.content_goal,
    title: opportunity.title,
    summary: opportunity.summary,
    recruiterScore: Math.round(Number(opportunity.recruiter_score) || 0),
    recruiterScoreBreakdown: opportunity.recruiter_score_breakdown,
    selectionReason: opportunity.selection_reason,
    evidence,
    evidenceStrength: strongestConfidence(evidence),
    personalExperience: POST_TYPE_META[opportunity.post_type].personalExperience,
    journal,
    dayNumber: opportunity.day_number,
    topic: options.topic ?? opportunity.title,
    format,
  };
}