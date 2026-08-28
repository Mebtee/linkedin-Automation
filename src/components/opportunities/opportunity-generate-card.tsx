"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { generatePostFromOpportunityAction } from "@/app/actions/content-opportunities";
import { CONTENT_GOAL_LABELS, POST_TYPE_META } from "@/config/recruiter";
import type { ContentOpportunityRow } from "@/types/content-opportunity";

type OpportunityGenerateCardProps = {
  opportunity: ContentOpportunityRow;
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  selected: {
    label: "Selected",
    className: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  generated: {
    label: "Generated",
    className: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  candidate: {
    label: "Candidate",
    className: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  rejected: {
    label: "Rejected",
    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
  approved: {
    label: "Approved",
    className: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  },
  published: {
    label: "Published",
    className: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
};

const EVIDENCE_RANK: Record<string, number> = {
  MISSING: 0,
  INFERRED_FROM_STRUCTURE: 1,
  SUPPORTED_BY_PDF: 2,
  USER_CONFIRMED: 3,
};

export function OpportunityGenerateCard({ opportunity }: OpportunityGenerateCardProps) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);

  const meta = POST_TYPE_META[opportunity.post_type];

  const rank = (confidence: string) => EVIDENCE_RANK[confidence] ?? 0;

  const strongestEvidence = opportunity.evidence.reduce(
    (best, ref) => (rank(ref.confidence) > rank(best) ? ref.confidence : best),
    "MISSING",
  );

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setDuplicate(false);

    const result = await generatePostFromOpportunityAction(opportunity.id);
    setGenerating(false);

    if (result.success) {
      if (result.created) {
        router.push(`/posts/${result.post.id}`);
        return;
      }
      setDuplicate(true);
      return;
    }

    setError(result.error);
  }, [opportunity.id, router]);

  const statusBadge = STATUS_BADGES[opportunity.status] ?? STATUS_BADGES.candidate!;

  return (
    <section
      aria-labelledby="co-card-heading"
      className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadge.className}`}>
          {statusBadge.label}
        </span>
        <span className="rounded bg-[#2563EB]/10 px-2 py-0.5 text-xs font-medium text-[#2563EB] dark:text-[#60a5fa]">
          Score {opportunity.recruiter_score}/100
        </span>
      </div>

      <h2
        id="co-card-heading"
        className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50"
      >
        {opportunity.title}
      </h2>

      <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
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
        {opportunity.day_number !== null && opportunity.day_number !== undefined && (
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Source day</dt>
            <dd className="font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
              {opportunity.day_number}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500 dark:text-zinc-400">Evidence</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-50">{strongestEvidence}</dd>
        </div>
      </dl>

      {opportunity.summary && (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{opportunity.summary}</p>
      )}

      {opportunity.selection_reason && (
        <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Why this one: </span>
          {opportunity.selection_reason}
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
        >
          {error}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="rounded-lg bg-[#0F172A] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-[#0F172A] dark:hover:bg-zinc-200"
        >
          {generating ? "Generating…" : "Generate Post"}
        </button>

        {duplicate && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            This opportunity already has a draft post. Refresh the Posts list to edit it.
          </span>
        )}
      </div>

      {generating && (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
          Building a draft from the confirmed evidence only. You review everything in the editor
          before it can be approved or published.
        </p>
      )}
    </section>
  );
}