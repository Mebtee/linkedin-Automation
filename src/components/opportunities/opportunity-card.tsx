"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { generatePostFromOpportunityAction } from "@/app/actions/content-opportunities";
import { publishPost } from "@/app/actions/generated-posts";
import { CONTENT_GOAL_LABELS, POST_TYPE_META } from "@/config/recruiter";
import type { ContentOpportunityRow } from "@/types/content-opportunity";
import type { GeneratedPostRow } from "@/types/generated-post";
import type { PublishRecommendation } from "@/types/recruiter-quality";
import {
  recommendationLabel,
  recommendationStyle,
} from "@/components/posts/recruiter-quality-panel";
import { PublishDialog } from "@/components/posts/publish-dialog";
import { OpportunityProgress } from "./opportunity-progress";

type OpportunityCardProps = {
  opportunity: ContentOpportunityRow;
  post: GeneratedPostRow | null;
  topic?: string | null;
};

const EVIDENCE_RANK: Record<string, number> = {
  MISSING: 0,
  INFERRED_FROM_STRUCTURE: 1,
  SUPPORTED_BY_PDF: 2,
  USER_CONFIRMED: 3,
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  candidate: {
    label: "Candidate",
    className: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  selected: {
    label: "Selected",
    className: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  generated: {
    label: "Generated",
    className: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  approved: {
    label: "Approved",
    className: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  },
  published: {
    label: "Published",
    className: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  rejected: {
    label: "Declined",
    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
};

function recommendedAction(
  status: ContentOpportunityRow["status"],
  recommendation: PublishRecommendation | null,
  postStatus: GeneratedPostRow["status"] | null,
): string {
  if (status === "approved" && postStatus === "approved")
    return "Publish this approved post to LinkedIn manually.";
  if (status === "approved")
    return "This approved draft was replaced — open it to approve the latest before publishing.";
  switch (status) {
    case "candidate":
    case "selected":
      return "Generate a LinkedIn post draft from this opportunity.";
    case "generated":
      if (recommendation === "do_not_publish")
        return "Fix the blocking issue before this can be approved.";
      if (recommendation === "needs_review")
        return "Review the flagged areas, then approve when ready.";
      return "Open the draft to review, edit, or approve it.";
    case "published":
      return "This post is live on LinkedIn.";
    case "rejected":
      return "This opportunity was declined and will not be generated.";
  }
}

export function OpportunityCard({
  opportunity,
  post,
  topic,
}: OpportunityCardProps) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const meta = POST_TYPE_META[opportunity.post_type];

  const rank = (confidence: string) => EVIDENCE_RANK[confidence] ?? 0;
  const strongestEvidence = opportunity.evidence.reduce(
    (best, ref) => (rank(ref.confidence) > rank(best) ? ref.confidence : best),
    "MISSING",
  );

  const recommendation: PublishRecommendation | null =
    post?.recruiter_quality_report?.recommendation ?? null;
  const qualityScore = post?.recruiter_quality_score ?? null;

  const statusBadge = STATUS_BADGES[opportunity.status] ?? STATUS_BADGES.candidate!;
  const hasGeneratedPost =
    opportunity.status === "generated" ||
    opportunity.status === "approved" ||
    opportunity.status === "published";
  const canGenerate =
    opportunity.status === "candidate" ||
    opportunity.status === "selected" ||
    (hasGeneratedPost && !post);
  const readyToPublish =
    opportunity.status === "approved" && post?.status === "approved";

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    setError(null);
    const result = await generatePostFromOpportunityAction(opportunity.id);
    setGenerating(false);
    if (result.success) {
      if (result.created) {
        router.push(`/posts/${result.post.id}`);
        return;
      }
      router.refresh();
      return;
    }
    setError(result.error);
  };

  const handlePublish = async () => {
    if (publishing || !post) return;
    setPublishing(true);
    setPublishOpen(false);
    const result = await publishPost(post.id);
    setPublishing(false);
    if (result.success) {
      router.refresh();
      return;
    }
    setError(result.error.message);
  };

  const postLink = post ? `/posts/${post.id}` : null;
  const draftLinkLabel =
    recommendation === "do_not_publish"
      ? "Review Issues"
      : recommendation === "needs_review"
        ? "Review Draft"
        : "Open Draft";

  return (
    <section
      aria-label={`Opportunity: ${opportunity.title}`}
      className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-medium text-[#06B6D4]">
              Day {opportunity.day_number ?? "—"}
            </span>
            {topic && (
              <>
                <span aria-hidden="true">·</span>
                <span>{topic}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>{meta.label}</span>
          </div>
          <h3 className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {opportunity.title}
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {CONTENT_GOAL_LABELS[opportunity.content_goal]} · Evidence:{" "}
            {strongestEvidence}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadge.className}`}
          >
            {statusBadge.label}
          </span>
          <span className="rounded bg-[#2563EB]/10 px-2 py-0.5 text-xs font-medium text-[#2563EB] dark:text-[#60a5fa]">
            Score {opportunity.recruiter_score}/100
          </span>
          {qualityScore !== null && recommendation && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${recommendationStyle(recommendation)}`}
            >
              Post quality {qualityScore}/100 · {recommendationLabel(recommendation)}
            </span>
          )}
          {post && post.status === "published" && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              Published to LinkedIn
            </span>
          )}
        </div>
      </div>

      <div className="mt-3">
        <OpportunityProgress
          status={opportunity.status}
          post={post}
          postRecommendation={recommendation}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
        >
          {error}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-medium text-zinc-600 dark:text-zinc-300">
          Recommended action:
        </span>
        {recommendedAction(
          opportunity.status,
          recommendation,
          post?.status ?? null,
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canGenerate && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-lg bg-[#0F172A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-[#0F172A] dark:hover:bg-zinc-200"
          >
            {generating ? "Generating…" : post ? "Generate New Draft" : "Generate Post"}
          </button>
        )}

        {readyToPublish && (
          <button
            type="button"
            onClick={() => setPublishOpen(true)}
            disabled={publishing}
            className="rounded-lg bg-[#0a66c2] px-4 py-2 text-sm font-medium text-white hover:bg-[#004182] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {publishing ? "Publishing…" : "Publish to LinkedIn"}
          </button>
        )}

        {hasGeneratedPost && postLink && (
          <a
            href={postLink}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              opportunity.status === "published"
                ? "border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                : `bg-[#0F172A] text-white hover:bg-[#1e293b] dark:bg-zinc-100 dark:text-[#0F172A] dark:hover:bg-zinc-200 ${
                    recommendation === "do_not_publish" ? "" : ""
                  }`
            }`}
          >
            {opportunity.status === "published" ? "View Published Post" : draftLinkLabel}
          </a>
        )}
      </div>

      <PublishDialog
        open={publishOpen}
        post={post}
        quality={post?.recruiter_quality_report ?? null}
        onConfirm={handlePublish}
        onCancel={() => setPublishOpen(false)}
        isPublishing={publishing}
      />
    </section>
  );
}