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
import type { PostFormat } from "@/types/ai";
import type { ContentOpportunityRow } from "@/types/content-opportunity";
import type { GeneratedPostRow } from "@/types/generated-post";
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
import { findGeneratedPostByOpportunity, annotateGeneratedPostQuality } from "@/services/generated-posts";
import { updateContentOpportunityStatus } from "./persistence";
import { buildRecruiterPostGenerationContext, journalRowToContext, strongestConfidence } from "./context";
import { qualityReportForPost } from "./quality";

export { buildRecruiterPostGenerationContext };

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

async function runOpportunityGeneration(opportunityId: string, options: { readonly regenerate?: boolean } = {}): Promise<GeneratePostFromOpportunityResult> {
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

  // 3. Duplicate protection: the FIRST generation never creates a second post
  //    for the same opportunity. Regeneration is exempt — the user explicitly
  //    asked for a NEW candidate, so duplicates of the current post are the
  //    point of the action (identical output is caught by the shared core).
  const existing = await findGeneratedPostByOpportunity(opportunity.id);
  if (existing && !options.regenerate) {
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

  // 9b. Assess the new post deterministically and persist the quality report.
  const report = qualityReportForPost(post, recruiter);
  const annotated = await annotateGeneratedPostQuality(post.id, {
    score: report.score,
    report,
  });

  // 10. Mark the opportunity `generated` ONLY after the post is persisted.
  //     Regeneration keeps the existing `generated` status.
  if (REQUIRED_STATUSES_FOR_UPDATE.has(opportunity.status)) {
    await updateContentOpportunityStatus(opportunity.id, "generated");
  }

  return { ok: true, post: annotated, created: true, duplicate: false };
}

/**
 * Generates a NEW candidate post from an already-generated opportunity
 * (Phase 5D regeneration). Unlike the first generation, this bypasses the
 * "existing post wins" shortcut so the reviewer can compare candidates. The
 * shared core's day/format/content-hash dedup still applies — a model that
 * returns identical content is rejected as a duplicate.
 */
export async function regeneratePostFromOpportunity(
  opportunityId: string,
): Promise<GeneratePostFromOpportunityResult> {
  try {
    return await runOpportunityGeneration(opportunityId, { regenerate: true });
  } catch (err) {
    const code =
      err instanceof AppError ? (err.code as RecruiterGenerationErrorCode) : "GENERATION_FAILED";
    const safe = GENERATION_ELIGIBLE_ERROR_CODES.has(code);
    return {
      ok: false,
      code: safe ? code : "GENERATION_FAILED",
      message: safe
        ? err instanceof Error
          ? err.message
          : "Could not regenerate a post from this opportunity."
        : "Post regeneration from this opportunity failed. Please try again.",
    };
  }
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