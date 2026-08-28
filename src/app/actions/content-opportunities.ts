"use server";

import type {
  ContentGoal,
  ContentOpportunityRow,
  ContentOpportunitySourceKind,
  ContentOpportunityStatus,
} from "@/types/content-opportunity";
import type { GeneratedPostRow } from "@/types/generated-post";
import {
  deleteContentOpportunity,
  getContentOpportunity,
  listContentOpportunities,
  updateContentOpportunityStatus,
} from "@/services/recruiter/persistence";
import { findGeneratedPostByOpportunity } from "@/services/generated-posts";
import type { PublishRecommendation } from "@/types/recruiter-quality";
import { generatePostFromOpportunity } from "@/services/recruiter/generation";
import {
  generateContentOpportunitiesForCourseMaterial,
  generateContentOpportunitiesForDay,
  selectBestContentOpportunity,
} from "@/services/recruiter";

// ─── Content Opportunity Server Actions (Phase 5B) ───────────────────────────
// Thin wrappers: business logic lives in src/services/recruiter/.
// Actions return plain result objects and never leak internals (no tokens,
// no chain-of-thought, no private evidence content).

export type GenerateOpportunitiesResult =
  | { success: true; opportunities: ContentOpportunityRow[]; count: number }
  | { success: false; error: string };

export async function generateContentOpportunitiesForDayAction(options: {
  readonly dayNumber: number;
  readonly goal?: ContentGoal;
}): Promise<GenerateOpportunitiesResult> {
  try {
    const opportunities = await generateContentOpportunitiesForDay(options);
    return { success: true, opportunities, count: opportunities.length };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Could not generate content opportunities.",
    };
  }
}

export async function generateContentOpportunitiesForCourseMaterialAction(options: {
  readonly courseMaterialId: string;
  readonly goal?: ContentGoal;
}): Promise<GenerateOpportunitiesResult> {
  try {
    const opportunities = await generateContentOpportunitiesForCourseMaterial(options);
    return { success: true, opportunities, count: opportunities.length };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Could not generate content opportunities.",
    };
  }
}

export type ListOpportunitiesResult =
  | { success: true; opportunities: ContentOpportunityRow[] }
  | { success: false; error: string };

export async function listContentOpportunitiesAction(options?: {
  readonly status?: ContentOpportunityStatus;
  readonly sourceType?: ContentOpportunitySourceKind;
  readonly dayNumber?: number;
  readonly limit?: number;
}): Promise<ListOpportunitiesResult> {
  try {
    const opportunities = await listContentOpportunities(options);
    return { success: true, opportunities };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Could not load content opportunities.",
    };
  }
}

export type GetOpportunityResult =
  | { success: true; opportunity: ContentOpportunityRow }
  | { success: false; error: string };

export async function getContentOpportunityAction(
  opportunityId: string,
): Promise<GetOpportunityResult> {
  try {
    const opportunity = await getContentOpportunity(opportunityId);
    if (!opportunity) {
      return { success: false, error: "Content opportunity not found." };
    }
    return { success: true, opportunity };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Could not load the content opportunity.",
    };
  }
}

export type SelectBestOpportunityResult =
  | {
      success: true;
      opportunity: ContentOpportunityRow | null;
      reason: string | null;
      diversityAdjusted: boolean;
    }
  | { success: false; error: string };

export async function selectBestContentOpportunityAction(): Promise<SelectBestOpportunityResult> {
  try {
    const best = await selectBestContentOpportunity();
    return {
      success: true,
      opportunity: best?.row ?? null,
      reason: best?.reason ?? null,
      diversityAdjusted: best?.diversityAdjusted ?? false,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Could not select the best content opportunity.",
    };
  }
}

export type UpdateOpportunityStatusResult =
  | { success: true; opportunity: ContentOpportunityRow }
  | { success: false; error: string };

export async function updateContentOpportunityStatusAction(options: {
  readonly opportunityId: string;
  readonly status: ContentOpportunityStatus;
  readonly selectionReason?: string | null;
}): Promise<UpdateOpportunityStatusResult> {
  try {
    const opportunity = await updateContentOpportunityStatus(
      options.opportunityId,
      options.status,
      options.selectionReason,
    );
    return { success: true, opportunity };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Could not update the content opportunity.",
    };
  }
}

export type DeleteOpportunityResult = { success: boolean; error?: string };

export async function deleteContentOpportunityAction(
  opportunityId: string,
): Promise<DeleteOpportunityResult> {
  try {
    await deleteContentOpportunity(opportunityId);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Could not delete the content opportunity.",
    };
  }
}

// ─── Post Generation From an Opportunity (Phase 5C) ──────────────────────────

export type GeneratePostFromOpportunityActionResult =
  | { success: true; post: GeneratedPostRow; created: boolean; duplicate: boolean }
  | { success: false; error: string; code?: string };

/**
 * Generates a draft LinkedIn post from a selected content opportunity by
 * delegating to the shared generation pipeline. The opportunity is advanced to
 * `generated` only when the post is successfully persisted. Generation never
 * auto-approves or auto-publishes — the post stays a draft for the `/posts/[id]`
 * editor.
 */
export async function generatePostFromOpportunityAction(
  opportunityId: string,
): Promise<GeneratePostFromOpportunityActionResult> {
  const result = await generatePostFromOpportunity(opportunityId);

  if (!result.ok) {
    return { success: false, error: result.message, code: result.code };
  }

  return {
    success: true,
    post: result.post,
    created: result.created,
    duplicate: result.duplicate,
  };
}

// ─── Linked Post Quality Summary (Phase 5D) ─────────────────────────────────

export type OpportunityPostQualityResult =
  | {
      success: true;
      post: {
        id: string;
        status: GeneratedPostRow["status"];
        score: number | null;
        recommendation: PublishRecommendation | null;
      } | null;
    }
  | { success: false; error: string };

/**
 * Returns a compact quality summary of the draft already generated for an
 * opportunity (if any). Used by the opportunities card so a reviewer sees the
 * post's status + quality without leaving the list. Owner-scoped.
 */
export async function getPostQualityForOpportunityAction(
  opportunityId: string,
): Promise<OpportunityPostQualityResult> {
  try {
    const post = await findGeneratedPostByOpportunity(opportunityId);
    if (!post) return { success: true, post: null };
    return {
      success: true,
      post: {
        id: post.id,
        status: post.status,
        score: post.recruiter_quality_score,
        recommendation: post.recruiter_quality_report?.recommendation ?? null,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Could not load the linked post quality.",
    };
  }
}