// ─── Content Opportunity → Post Generation Adapter (Phase 5C) ────────────────
// Bridges a selected ContentOpportunity into the EXISTING post-generation
// pipeline (src/services/ai/generation.ts). There is exactly ONE AI generation
// system: the adapter builds a recruiter-aware PostGenerationInput and
// delegates the provider call / validation / hashing / duplicate protection /
// persistence to `generatePostFromPreparedInput`.
//
// Anti-hallucination contract (carried from Phase 5A/5B, never weakened here):
//   - The generation is only allowed from `candidate` / `selected` / `generated`
//     opportunities. `rejected` opportunities are never generated.
//   - Personal-experience post types require USER_CONFIRMED evidence; otherwise
//     the generation is refused (`INSUFFICIENT_EVIDENCE`).
//   - The opportunity is marked `generated` ONLY after a post is successfully
//     persisted. A failed generation never changes the status.
//   - Duplicate protection: re-running generation for an already-generated
//     opportunity returns the existing post instead of creating a second one.
//
// All data access is owner-scoped (profile_id = auth.uid()); a user can never
// observe or generate another user's opportunity.

import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/utils/errors";
import type { JournalContext, PostFormat } from "@/types/ai";
import type {
  ContentOpportunityRow,
  RecruiterPostGenerationContext,
  RecruiterEvidenceEntry,
} from "@/types/content-opportunity";
import type { EvidenceType } from "@/types/course-material";
import type { GeneratedPostRow } from "@/types/generated-post";
import type { JournalEntry } from "@/types/journal";
import type { PostType } from "@/types/content-opportunity";
import { POST_TYPE_META } from "@/config/recruiter";
import {
  buildPostGenerationInput,
} from "@/services/ai/input-builder";
import {
  generatePostFromPreparedInput,
  loadCurriculumDayForRecruiter,
  loadJournalEntryForRecruiter,
  loadModuleForRecruiter,
} from "@/services/ai/generation";
import { findGeneratedPostByOpportunity } from "@/services/generated-posts";
import { updateContentOpportunityStatus } from "./persistence";

// ─── Error Codes ─────────────────────────────────────────────────────────────

export type RecruiterGenerationErrorCode =
  | "AUTH_REQUIRED"
  | "OPPORTUNITY_NOT_FOUND"
  | "OPPORTUNITY_INELIGIBLE"
  | "INSUFFICIENT_EVIDENCE"
  | "CURRICULUM_NOT_FOUND"
  | "JOURNAL_NOT_FOUND"
  | "JOURNAL_NOT_SUBMITTED"
  | "GENERATION_DUPLICATE"
  | "DATABASE_ERROR"
  | "VALIDATION_ERROR"
  | "GENERATION_FAILED";

export type GeneratePostFromOpportunityResult =
  | { readonly ok: true; readonly post: GeneratedPostRow; readonly created: boolean; readonly duplicate: boolean }
  | { readonly ok: false; readonly code: RecruiterGenerationErrorCode; readonly message: string };

const GENERATION_ELIGIBLE_STATUSES = new Set(["candidate", "selected", "generated"]);
const REQUIRED_STATUSES_FOR_UPDATE = new Set(["candidate", "selected"]);

const CONFIDENCE_ORDER: Record<EvidenceType, number> = {
  USER_CONFIRMED: 4,
  SUPPORTED_BY_PDF: 3,
  INFERRED_FROM_STRUCTURE: 2,
  MISSING: 1,
};

// ─── Format Selection ────────────────────────────────────────────────────────
// Maps each post type to the existing PostFormat that best fits its structure.
// The same post type always resolves to the same format (deterministic).

export function selectFormatForPostType(postType: PostType): PostFormat {
  switch (postType) {
    case "PROJECT_SHOWCASE":
    case "API_INTEGRATION":
    case "AI_ENGINEERING":
      return "project";
    case "PROBLEM_SOLUTION":
    case "DEBUGGING_STORY":
    case "DEPLOYMENT_STORY":
    case "ENGINEERING_DECISION":
      return "challenge";
    case "TECHNICAL_LESSON":
      return "concept";
    case "SECURITY_LESSON":
    case "DATABASE_ENGINEERING":
      return "practical-lesson";
    case "LEARNING_MILESTONE":
    case "CAREER_PROGRESS":
      return "reflection";
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Maps a submitted journal row into the camelCase AI/journal shape. */
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

function strongestConfidence(entries: readonly { readonly confidence: EvidenceType }[]): EvidenceType {
  let best: EvidenceType = "MISSING";
  for (const entry of entries) {
    if (CONFIDENCE_ORDER[entry.confidence] > CONFIDENCE_ORDER[best]) best = entry.confidence;
  }
  return best;
}

// ─── Context Builder (pure, deterministic) ───────────────────────────────────

/**
 * Builds the recruiter-aware generation context for an opportunity.
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

// ─── Orchestrator ────────────────────────────────────────────────────────────

/**
 * Generates a draft LinkedIn post from a content opportunity by delegating to
 * the shared generation core. Returns a discriminated result — expected
 * failures are reported instead of thrown.
 */
export async function generatePostFromOpportunity(
  opportunityId: string,
): Promise<GeneratePostFromOpportunityResult> {
  try {
    return await runOpportunityGeneration(opportunityId);
  } catch (err) {
    const code =
      err instanceof AppError ? (err.code as RecruiterGenerationErrorCode) : "GENERATION_FAILED";
    const safe = GENERATION_ELIGIBLE_ERROR_CODES.has(code);
    return {
      ok: false,
      code: safe ? code : "GENERATION_FAILED",
      // Expected business failures (auth, missing data, evidence, duplicates)
      // carry intentionally written messages. Unexpected failures — including
      // raw AI-provider errors that could contain secrets — stay generic so a
      // token or API key can never leak into a UI or logs.
      message: safe
        ? err instanceof Error
          ? err.message
          : "Could not generate a post from this opportunity."
        : "Post generation from this opportunity failed. Please try again.",
    };
  }
}

const GENERATION_ELIGIBLE_ERROR_CODES: ReadonlySet<string> = new Set([
  "AUTH_REQUIRED",
  "OPPORTUNITY_NOT_FOUND",
  "OPPORTUNITY_INELIGIBLE",
  "INSUFFICIENT_EVIDENCE",
  "CURRICULUM_NOT_FOUND",
  "JOURNAL_NOT_FOUND",
  "JOURNAL_NOT_SUBMITTED",
  "GENERATION_DUPLICATE",
  "DATABASE_ERROR",
  "VALIDATION_ERROR",
]);

async function runOpportunityGeneration(opportunityId: string): Promise<GeneratePostFromOpportunityResult> {
  if (typeof opportunityId !== "string" || opportunityId.trim() === "") {
    throw new AppError("opportunityId is required.", { code: "VALIDATION_ERROR" });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new AppError("Authentication required.", { code: "AUTH_REQUIRED" });
  }

  // 1. Load own opportunity (owner-scoped).
  const opportunity = await loadOwnOpportunity(supabase, user.id, opportunityId.trim());

  // 2. Rejected opportunities are never generated.
  if (opportunity.status === "rejected") {
    throw new AppError(
      "This content opportunity was rejected and cannot be generated.",
      { code: "OPPORTUNITY_INELIGIBLE" },
    );
  }

  // 3. Duplicate protection: never generate twice for the same opportunity.
  const existing = await findGeneratedPostByOpportunity(opportunity.id);
  if (existing) {
    return { ok: true, post: existing, created: false, duplicate: true };
  }

  // 4. Status gate: only candidate / selected / generated.
  if (!GENERATION_ELIGIBLE_STATUSES.has(opportunity.status)) {
    throw new AppError(
      `Content opportunity (${opportunity.status}) is not ready for generation.`,
      { code: "OPPORTUNITY_INELIGIBLE" },
    );
  }

  // 5. Anti-hallucination gate: personal-experience post types require
  //    USER_CONFIRMED evidence. Learning post types never need it.
  const evidenceStrength = strongestConfidence(opportunity.evidence ?? []);
  const personal = POST_TYPE_META[opportunity.post_type].personalExperience;
  if (personal && evidenceStrength !== "USER_CONFIRMED") {
    throw new AppError(
      `${POST_TYPE_META[opportunity.post_type].label} posts require USER_CONFIRMED evidence. This opportunity's strongest evidence is ${evidenceStrength}.`,
      { code: "INSUFFICIENT_EVIDENCE" },
    );
  }

  // 6. The post must profile a curriculum day (journaled learning).
  const dayNumber = opportunity.day_number;
  if (!dayNumber) {
    throw new AppError(
      "This content opportunity is not linked to a curriculum day.",
      { code: "OPPORTUNITY_INELIGIBLE" },
    );
  }

  // 7. Reuse the exact loaders behind the daily path.
  const curriculumDay = await loadCurriculumDayForRecruiter(supabase, dayNumber);
  const moduleData = await loadModuleForRecruiter(supabase, curriculumDay.module_id);
  const journal = await loadJournalEntryForRecruiter(supabase, user.id, dayNumber);

  if (journal.status !== "submitted") {
    throw new AppError(
      `Journal entry for Day ${dayNumber} must be submitted before generating a post from this opportunity. Current status: ${journal.status}.`,
      { code: "JOURNAL_NOT_SUBMITTED" },
    );
  }

  // 8. Resolve the format deterministically from the post type.
  const format = selectFormatForPostType(opportunity.post_type);

  // 9. Build the recruiter-aware input and delegate to the shared core.
  const journalContext = journalRowToContext(journal);
  const recruiter = buildRecruiterPostGenerationContext(opportunity, journalContext, format, {
    topic: curriculumDay.topic,
  });

  const input = buildPostGenerationInput({
    curriculumDay,
    module: moduleData,
    journal,
    format,
    recruiter,
  });

  const post = await generatePostFromPreparedInput({
    dayNumber,
    journalEntryId: journal.id,
    format,
    input,
    opportunityId: opportunity.id,
  });

  // 10. Mark the opportunity `generated` ONLY after the post is persisted.
  if (REQUIRED_STATUSES_FOR_UPDATE.has(opportunity.status)) {
    await updateContentOpportunityStatus(opportunity.id, "generated");
  }

  return { ok: true, post, created: true, duplicate: false };
}

// ─── Owner-Scoped Lookup ─────────────────────────────────────────────────────
// Mirrors the persistence module's loader so generation never observes another
// user's opportunity via the shared core.

async function loadOwnOpportunity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  opportunityId: string,
): Promise<ContentOpportunityRow> {
  const { data, error } = await supabase
    .from("content_opportunities")
    .select("*")
    .eq("id", opportunityId)
    .eq("profile_id", userId)
    .single();

  if (error || !data) {
    throw new AppError("Content opportunity not found.", {
      code: "OPPORTUNITY_NOT_FOUND",
    });
  }

  return data as ContentOpportunityRow;
}