// ─── Recruiter Post Quality Persistence Service (Phase 5D) ───────────────────
// Server-side gateway that (re)assesses a saved generated post against its
// content opportunity and persists the result.
//
// Used by:
//   - the post editor page (`/posts/[id]`) to render the quality panel,
//   - the approve gate, which ALWAYS re-evaluates before approving so a
//     tampered stored report can never bypass the quality gate,
//   - the update path, so the review panel reflects the latest edited text.
//
// The evaluator itself is pure (src/services/recruiter/quality.ts); this module
// only supplies the context (opportunity + enriched evidence + journal) the
// evaluator needs. It never crafts new evidence.

import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/utils/errors";
import type { JournalContext } from "@/types/ai";
import type { RecruiterQualityReport } from "@/types/recruiter-quality";
import type { GeneratedPostRow } from "@/types/generated-post";
import type { ContentOpportunityRow } from "@/types/content-opportunity";
import {
  loadCurriculumDayForRecruiter,
  loadJournalEntryForRecruiter,
} from "@/services/ai/generation";
import { annotateGeneratedPostQuality } from "@/services/generated-posts";
import { buildRecruiterPostGenerationContext, journalRowToContext } from "./context";
import { qualityReportForPost } from "./quality";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const EMPTY_JOURNAL: JournalContext = {
  whatILearned: null,
  whatIPracticed: null,
  whatIBuilt: null,
  challenge: null,
  howISolvedIt: null,
  keyTakeaway: null,
  tomorrowFocus: null,
  projectName: null,
  projectDescription: null,
  codeReference: null,
  resourcesUsed: null,
  confidenceLevel: null,
  additionalNotes: null,
};

async function requireAuth(supabase: SupabaseClient): Promise<{ id: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return user;
}

async function loadOwnPost(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
): Promise<GeneratedPostRow | null> {
  const { data, error } = await supabase
    .from("generated_posts")
    .select("*")
    .eq("id", postId)
    .eq("profile_id", userId)
    .single();

  if (error || !data) return null;
  return data as GeneratedPostRow;
}

async function loadOwnOpportunity(
  supabase: SupabaseClient,
  userId: string,
  opportunityId: string,
): Promise<ContentOpportunityRow | null> {
  const { data, error } = await supabase
    .from("content_opportunities")
    .select("*")
    .eq("id", opportunityId)
    .eq("profile_id", userId)
    .single();

  if (error || !data) return null;
  return data as ContentOpportunityRow;
}

/**
 * (Re)evaluates a saved post and persists the fresh quality report.
 *
 * Returns:
 *   - `null` when the caller is anonymous or the post is not opportunity-backed
 *     (journal-only posts are not part of the recruiter quality system), or the
 *     post does not exist.
 *   - An object with the freshly stored report otherwise.
 *
 * The report is ALWAYS recomputed here — the stored value is never trusted for
 * the approve gate.
 */
export async function evaluateRecruiterPostForSavedPost(
  postId: string,
): Promise<{ post: GeneratedPostRow; report: RecruiterQualityReport } | null> {
  const supabase = await createClient();
  const user = await requireAuth(supabase);
  if (!user) return null;

  const post = await loadOwnPost(supabase, user.id, postId);
  if (!post || !post.opportunity_id) return null;

  const opportunity = await loadOwnOpportunity(supabase, user.id, post.opportunity_id);
  if (!opportunity) {
    throw new AppError("Content opportunity not found.", {
      code: "OPPORTUNITY_NOT_FOUND",
    });
  }

  let journal: JournalContext = EMPTY_JOURNAL;
  try {
    const entry = await loadJournalEntryForRecruiter(supabase, user.id, post.day_number);
    journal = journalRowToContext(entry);
  } catch {
    // Evaluation stays possible with an empty journal: evidence values are null,
    // which lowers the scores honestly rather than inventing anything.
  }

  let topic = opportunity.title;
  try {
    const curriculumDay = await loadCurriculumDayForRecruiter(supabase, post.day_number);
    topic = curriculumDay.topic;
  } catch {
    // Fall back to the opportunity title when the day is no longer available.
  }

  const context = buildRecruiterPostGenerationContext(opportunity, journal, post.format, {
    topic,
  });

  const report = qualityReportForPost(post, context);

  try {
    const refreshed = await annotateGeneratedPostQuality(post.id, {
      score: report.score,
      report,
    });
    return { post: refreshed, report };
  } catch {
    // Persistence failures should not block the review UI: return the computed
    // report with the un-annotated post.
    return { post, report };
  }
}