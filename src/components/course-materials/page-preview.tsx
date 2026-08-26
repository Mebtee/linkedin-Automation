"use client";

import { useState, useCallback } from "react";

// ─── Page Preview ───────────────────────────────────────────────────────────
// Lightweight extracted-text page viewer with navigation.
// Uses the text stored in course_material_pages during ingestion.
// No external PDF viewer dependency.

type PagePreviewProps = {
  pages: { pageNumber: number; text: string }[];
  highlightPage?: number | null;
  onNavigateToPage?: (pageNumber: number) => void;
};

export function PagePreview({ pages, highlightPage, onNavigateToPage }: PagePreviewProps) {
  const [currentPage, setCurrentPage] = useState(
    highlightPage && highlightPage >= 1 && highlightPage <= pages.length
      ? highlightPage
      : 1,
  );

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= pages.length) {
        setCurrentPage(page);
        onNavigateToPage?.(page);
      }
    },
    [pages.length, onNavigateToPage],
  );

  if (pages.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
        No extracted pages available.
      </div>
    );
  }

  const pageData = pages.find((p) => p.pageNumber === currentPage);
  const pageText = pageData?.text ?? "";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header with navigation */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Document Preview
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Previous page"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <span className="text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
            {currentPage} / {pages.length}
          </span>
          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= pages.length}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Next page"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Page content */}
      <div className="max-h-80 overflow-y-auto p-4">
        {pageText.trim() ? (
          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
            {pageText}
          </pre>
        ) : (
          <p className="text-xs italic text-zinc-400 dark:text-zinc-500">
            This page contains no extractable text.
          </p>
        )}
      </div>

      {/* Page indicator dots for small document counts */}
      {pages.length <= 20 && (
        <div className="flex flex-wrap gap-1 border-t border-zinc-200 px-4 py-2 dark:border-zinc-800">
          {pages.map((p) => (
            <button
              key={p.pageNumber}
              type="button"
              onClick={() => goToPage(p.pageNumber)}
              className={`h-2 w-2 rounded-full transition-colors ${
                p.pageNumber === currentPage
                  ? "bg-[#2563EB]"
                  : p.pageNumber === highlightPage
                    ? "bg-amber-400"
                    : "bg-zinc-300 hover:bg-zinc-400 dark:bg-zinc-600 dark:hover:bg-zinc-500"
              }`}
              aria-label={`Go to page ${p.pageNumber}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
