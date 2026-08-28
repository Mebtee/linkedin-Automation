import type { ContentOpportunityRow } from "@/types/content-opportunity";
import { CONTENT_GOAL_LABELS, POST_TYPE_META } from "@/config/recruiter";

/**
 * Presents the selected content opportunity behind a recruiter post (Phase 5D).
 *
 * The opportunity row (including `recruiter_score`) is the one recorded during
 * Phase 5B selection — it is displayed as-stored and is never recomputed or
 * rewritten on this screen. `topic`/`moduleTitle` are curriculum context loaded
 * server-side and are purely informational.
 */
export function OpportunitySummaryPanel({
  opportunity,
  topic,
  moduleTitle,
}: {
  readonly opportunity: ContentOpportunityRow | null;
  readonly topic?: string | null;
  readonly moduleTitle?: string | null;
}) {
  if (!opportunity) {
    return (
      <section className="rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
          Selected Opportunity
        </h3>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          This post is not linked to a content opportunity.
        </p>
      </section>
    );
  }

  const meta = POST_TYPE_META[opportunity.post_type];

  const evidenceStatus = (() => {
    const rank: Record<string, number> = {
      MISSING: 0,
      INFERRED_FROM_STRUCTURE: 1,
      SUPPORTED_BY_PDF: 2,
      USER_CONFIRMED: 3,
    };
    return opportunity.evidence.reduce(
      (best, ref) =>
        (rank[ref.confidence] ?? 0) > (rank[best] ?? 0)
          ? ref.confidence
          : best,
      "MISSING",
    );
  })();

  return (
    <section
      aria-label="Selected content opportunity"
      className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Selected Opportunity
      </h3>

      <dl className="mt-3 space-y-1.5 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500 dark:text-zinc-400">Post type</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-50">{meta.label}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500 dark:text-zinc-400">Content goal</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-50">
            {CONTENT_GOAL_LABELS[opportunity.content_goal]}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500 dark:text-zinc-400">Opportunity score</dt>
          <dd className="font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
            {opportunity.recruiter_score}/100
          </dd>
        </div>
        {opportunity.day_number !== null && opportunity.day_number !== undefined && (
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Source day</dt>
            <dd className="font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
              {opportunity.day_number}
            </dd>
          </div>
        )}
        {topic && (
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Topic</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-50">{topic}</dd>
          </div>
        )}
        {moduleTitle && (
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Module</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-50">{moduleTitle}</dd>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500 dark:text-zinc-400">Evidence</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-50">
            {evidenceStatus}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500 dark:text-zinc-400">Status</dt>
          <dd className="font-medium capitalize text-zinc-900 dark:text-zinc-50">
            {opportunity.status}
          </dd>
        </div>
      </dl>

      {opportunity.selection_reason && (
        <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Why this one: </span>
          {opportunity.selection_reason}
        </p>
      )}
    </section>
  );
}