"use client";

import type { CourseJournalProposal, MatchConfidence } from "@/types/course-material";

// ─── Curriculum Match Panel ─────────────────────────────────────────────────
// Displays the detected curriculum day, module, topic, match method, and
// confidence. When confidence is LOW/UNKNOWN, requires manual selection.

const TOTAL_DAYS = 105;

const CONFIDENCE_INFO: Record<
  MatchConfidence,
  { label: string; className: string; needsManual: boolean }
> = {
  EXACT: {
    label: "Exact match",
    className: "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    needsManual: false,
  },
  HIGH: {
    label: "High confidence",
    className: "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    needsManual: false,
  },
  MEDIUM: {
    label: "Medium confidence",
    className: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    needsManual: false,
  },
  LOW: {
    label: "Low confidence",
    className: "bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    needsManual: true,
  },
  UNKNOWN: {
    label: "No match found",
    className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    needsManual: true,
  },
};

type CurriculumMatchPanelProps = {
  proposal: CourseJournalProposal;
  selectedDay: number;
  onDayChange: (dayNumber: number) => void;
};

export function CurriculumMatchPanel({
  proposal,
  selectedDay,
  onDayChange,
}: CurriculumMatchPanelProps) {
  const confidence = CONFIDENCE_INFO[proposal.matchConfidence];
  const needsManual = confidence.needsManual || proposal.curriculumDay === 0;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Curriculum Match
      </h2>

      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500 dark:text-zinc-400">Day</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-50">
            {proposal.curriculumDay > 0
              ? `Day ${proposal.curriculumDay} / ${TOTAL_DAYS}`
              : "—"}
          </dd>
        </div>

        {proposal.moduleTitle && (
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500 dark:text-zinc-400">Module</dt>
            <dd className="text-right font-medium text-zinc-900 dark:text-zinc-50">
              {proposal.moduleNumber !== null ? `${proposal.moduleNumber} · ` : ""}
              {proposal.moduleTitle}
            </dd>
          </div>
        )}

        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500 dark:text-zinc-400">Topic</dt>
          <dd className="truncate text-right font-medium text-zinc-900 dark:text-zinc-50">
            {proposal.topic || "—"}
          </dd>
        </div>

        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500 dark:text-zinc-400">Match method</dt>
          <dd className="text-right font-medium text-zinc-900 dark:text-zinc-50">
            {proposal.explicitDayMatch
              ? "Explicit reference"
              : proposal.matchConfidence !== "UNKNOWN"
                ? "Similarity match"
                : "—"}
          </dd>
        </div>
      </dl>

      {/* Confidence badge */}
      <p className="mt-3">
        <span className={`inline-block rounded-md px-2 py-1 text-xs font-medium ${confidence.className}`}>
          {confidence.label}
        </span>
      </p>

      {/* Rationale */}
      {proposal.rationale.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          {proposal.rationale.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {/* Manual selection — required when confidence is LOW/UNKNOWN */}
      <div className="mt-4">
        {needsManual && (
          <div
            role="note"
            className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
          >
            Could not confidently determine the curriculum day. Please select the correct day below.
          </div>
        )}

        <label
          htmlFor="cm-day-select"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Curriculum Day {needsManual && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        <select
          id="cm-day-select"
          value={selectedDay}
          onChange={(e) => onDayChange(Number(e.target.value))}
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        >
          <option value={0}>Select a day…</option>
          {proposal.candidates.length > 0 && (
            <optgroup label="Suggested matches">
              {proposal.candidates.map((c) => (
                <option key={c.dayNumber} value={c.dayNumber}>
                  Day {c.dayNumber} — {c.topic}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="All days">
            {Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Day {n}
              </option>
            ))}
          </optgroup>
        </select>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          The matcher may be wrong — always confirm the day.
        </p>
      </div>
    </div>
  );
}
