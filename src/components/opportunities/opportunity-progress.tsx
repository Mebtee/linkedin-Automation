import type { ContentOpportunityStatus } from "@/types/content-opportunity";
import type { GeneratedPostRow } from "@/types/generated-post";
import type { PublishRecommendation } from "@/types/recruiter-quality";

type OpportunityProgressProps = {
  status: ContentOpportunityStatus;
  post: GeneratedPostRow | null;
  postRecommendation: PublishRecommendation | null;
};

const STEPS = [
  { key: "opportunity", label: "Opportunity" },
  { key: "generated", label: "Generated" },
  { key: "reviewed", label: "Reviewed" },
  { key: "approved", label: "Approved" },
  { key: "published", label: "Published" },
] as const;

/**
 * Phase 5E progress indicator for the manual workflow:
 * Opportunity → Generated → Reviewed → Approved → Published.
 * Publishing is never shown as automatic — reaching "Published" always
 * requires the user's manual publish action.
 */
export function OpportunityProgress({
  status,
  post,
  postRecommendation,
}: OpportunityProgressProps) {
  const activeIndex = (() => {
    if (status === "published" || status === "approved") return 4;
    if (status === "generated" && post) {
      if (post.status === "published") return 4;
      if (post.status === "approved") return 3;
      if (postRecommendation === "do_not_publish") return 1;
      if (postRecommendation === "needs_review") return 2;
      return 2;
    }
    return 0;
  })();

  const doNotPublish = postRecommendation === "do_not_publish";

  return (
    <ol aria-label="Opportunity progress" className="flex items-center gap-1 text-[10px]">
      {STEPS.map((step, index) => {
        const done = index < activeIndex;
        const current = index === activeIndex;
        const reachedPublished =
          status === "published" || post?.status === "published";
        return (
          <li key={step.key} className="flex items-center gap-1">
            <span
              className={`rounded-full px-1.5 py-0.5 font-medium ${
                current
                  ? doNotPublish && step.key === "generated"
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#2563EB]/20 dark:text-[#60a5fa]"
                  : done
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : reachedPublished && step.key === "published"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "text-zinc-400 dark:text-zinc-500 opacity-60"
              }`}
            >
              {step.label}
            </span>
            {index < STEPS.length - 1 && (
              <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-600">
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}