"use client";

import { useState } from "react";
import type { JournalFieldSource, EvidenceType } from "@/types/course-material";

// ─── Evidence Panel ─────────────────────────────────────────────────────────
// Expandable panel showing evidence traceability for a single journal field.
// Displays evidence status, source type, and page numbers.
// Never exposes hidden model reasoning or chain-of-thought.

const EVIDENCE_BADGES: Record<
  EvidenceType,
  { label: string; className: string }
> = {
  SUPPORTED_BY_PDF: {
    label: "PDF Evidence",
    className: "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  },
  INFERRED_FROM_STRUCTURE: {
    label: "Curriculum Inferred",
    className: "bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  USER_CONFIRMED: {
    label: "User Confirmed",
    className: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  MISSING: {
    label: "Not Found",
    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  pdf: "Course PDF",
  curriculum: "Curriculum Data",
  user: "User Input",
  ai: "AI Enhancement",
  missing: "Not Available",
};

type EvidencePanelProps = {
  source: JournalFieldSource | undefined;
  onNavigateToPage?: (pageNumber: number) => void;
};

export function EvidencePanel({ source, onNavigateToPage }: EvidencePanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!source) return null;

  const badge = EVIDENCE_BADGES[source.confidence];
  const isMissing = source.confidence === "MISSING";

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        aria-expanded={expanded}
      >
        <svg
          className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        Evidence details
      </button>

      {expanded && (
        <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500 dark:text-zinc-400">Status</dt>
              <dd>
                <span className={`inline-block rounded px-1.5 py-0.5 font-medium ${badge.className}`}>
                  {badge.label}
                </span>
              </dd>
            </div>

            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500 dark:text-zinc-400">Source</dt>
              <dd className="font-medium text-zinc-700 dark:text-zinc-300">
                {SOURCE_TYPE_LABELS[source.sourceType] ?? source.sourceType}
              </dd>
            </div>

            {!isMissing && source.pageNumbers.length > 0 && (
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500 dark:text-zinc-400">Page(s)</dt>
                <dd className="font-medium text-zinc-700 dark:text-zinc-300">
                  {source.pageNumbers.length === 1 ? (
                    <button
                      type="button"
                      onClick={() => onNavigateToPage?.(source.pageNumbers[0]!)}
                      className="text-[#2563EB] hover:underline"
                    >
                      Page {source.pageNumbers[0]}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onNavigateToPage?.(source.pageNumbers[0]!)}
                      className="text-[#2563EB] hover:underline"
                    >
                      Pages {source.pageNumbers[0]}–{source.pageNumbers[source.pageNumbers.length - 1]}
                    </button>
                  )}
                </dd>
              </div>
            )}

            {isMissing && (
              <div className="mt-1 rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                Not found in the course material. Please provide this yourself.
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
