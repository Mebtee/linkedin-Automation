import type { RecruiterQualityReport } from "@/types/recruiter-quality";
import { RECRUITER_QUALITY_DIMENSIONS } from "@/types/recruiter-quality";
import { recruiterQuality } from "@/config/recruiter";

const DIMENSION_LABELS: Record<(typeof RECRUITER_QUALITY_DIMENSIONS)[number], string> = {
  recruiterRelevance: "Recruiter relevance",
  evidenceStrength: "Evidence strength",
  technicalDepth: "Technical depth",
  practicalExperience: "Practical experience",
  problemSolving: "Problem solving",
  clarity: "Clarity",
  authenticity: "Authenticity",
  learningGrowth: "Learning & growth",
};

export function recommendationStyle(recommendation: RecruiterQualityReport["recommendation"]): string {
  switch (recommendation) {
    case "strong":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "ready":
      return "bg-[#06B6D4]/10 text-[#06B6D4] dark:bg-[#06B6D4]/20 dark:text-cyan-300";
    case "needs_review":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "do_not_publish":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  }
}

export function recommendationLabel(recommendation: RecruiterQualityReport["recommendation"]): string {
  switch (recommendation) {
    case "strong":
      return "Strong";
    case "ready":
      return "Ready";
    case "needs_review":
      return "Needs review";
    case "do_not_publish":
      return "Do not publish";
  }
}

/**
 * Renders the deterministic post-quality report (Phase 5D). Receives only the
 * safe report shape — no prompts, no evidence dumps, no hidden reasoning.
 */
export function RecruiterQualityPanel({
  report,
}: {
  readonly report: RecruiterQualityReport | null;
}) {
  if (!report) {
    return (
      <section className="rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
          Recruiter Quality
        </h3>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          No quality report yet. This post is not linked to a content opportunity.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Recruiter quality review"
      className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Recruiter Quality
        </h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${recommendationStyle(report.recommendation)}`}
        >
          {recommendationLabel(report.recommendation)}
        </span>
      </div>

      <div className="mt-3 flex items-end gap-1">
        <span className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {report.score}
        </span>
        <span className="mb-0.5 text-sm font-medium text-zinc-400">/ 100</span>
      </div>

      <dl className="mt-4 space-y-1.5">
        {RECRUITER_QUALITY_DIMENSIONS.map((dimension) => {
          const value = report.dimensions[dimension] ?? 0;
          const weight = recruiterQuality.weights[dimension];
          return (
            <div key={dimension} className="grid grid-cols-[1fr_auto] items-center gap-2">
              <div className="flex items-center justify-between gap-2">
                <dt className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {DIMENSION_LABELS[dimension]}
                </dt>
                <dd className="text-xs font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                  {value}
                </dd>
              </div>
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-[#2563EB]"
                  style={{ width: `${Math.max(3, Math.min(100, value))}%` }}
                />
              </div>
              <span className="sr-only">weight {weight}</span>
            </div>
          );
        })}
      </dl>

      {report.strengths.length > 0 && (
        <ul className="mt-4 space-y-1" aria-label="Strengths">
          {report.strengths.map((strength) => (
            <li key={strength} className="flex gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
              <span aria-hidden="true" className="mt-px text-emerald-500">✓</span>
              {strength}
            </li>
          ))}
        </ul>
      )}

      {report.improvements.length > 0 && (
        <ul className="mt-3 space-y-1" aria-label="Suggested improvements">
          {report.improvements.map((improvement) => (
            <li key={improvement} className="flex gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
              <span aria-hidden="true" className="mt-px text-[#06B6D4]">→</span>
              {improvement}
            </li>
          ))}
        </ul>
      )}

      {report.warnings.length > 0 && (
        <ul className="mt-3 space-y-1" aria-label="Warnings">
          {report.warnings.map((warning) => {
            const critical = warning.startsWith("Critical:");
            return (
              <li
                key={warning}
                className={`flex gap-1.5 text-xs ${
                  critical
                    ? "font-medium text-red-700 dark:text-red-400"
                    : "text-amber-700 dark:text-amber-400"
                }`}
              >
                <span aria-hidden="true" className="mt-px">⚠</span>
                {warning}
              </li>
            );
          })}
        </ul>
      )}

      {report.evaluatedAt && (
        <p className="mt-4 text-[10px] text-zinc-400 dark:text-zinc-500">
          Evaluated {new Date(report.evaluatedAt).toLocaleString("en-US")}
        </p>
      )}
    </section>
  );
}