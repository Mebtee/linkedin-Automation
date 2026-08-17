"use client";

import Link from "next/link";
import { useState, useMemo } from "react";

import { brand } from "@/config/brand";
import type { JournalHistoryItem, HistoryFilter, HistorySort } from "@/types/journal-history";
import { truncateText, formatHistoryDate } from "@/types/journal-history";

type JournalHistoryListProps = {
  items: JournalHistoryItem[];
};

const STATUS_STYLES = {
  completed:
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  draft: "bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#2563EB]/20 dark:text-[#2563EB]",
} as const;

const CONFIDENCE_LABELS = [
  "",
  "Need more practice",
  "Still learning",
  "Getting comfortable",
  "Good understanding",
  "Very confident",
];

export function JournalHistoryList({ items }: JournalHistoryListProps) {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [sort, setSort] = useState<HistorySort>("newest");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let result = [...items];

    // Apply status filter
    if (filter === "completed") {
      result = result.filter((item) => item.status === "completed");
    } else if (filter === "draft") {
      result = result.filter((item) => item.status === "draft");
    }

    // Apply search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.day_number.toString().includes(q) ||
          item.topic.toLowerCase().includes(q) ||
          item.module_title.toLowerCase().includes(q),
      );
    }

    // Apply sort
    result.sort((a, b) =>
      sort === "newest"
        ? b.day_number - a.day_number
        : a.day_number - b.day_number,
    );

    return result;
  }, [items, filter, sort, search]);

  return (
    <div className="space-y-4">
      {/* Filters and Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter entries">
          {(["all", "completed", "draft"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${
                filter === f
                  ? "bg-[#0F172A] text-white dark:bg-zinc-100 dark:text-[#0F172A]"
                  : "border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              {f === "all" ? "All" : f === "completed" ? "Completed" : "Drafts"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="history-search" className="sr-only">
            Search journal entries
          </label>
          <input
            id="history-search"
            type="text"
            placeholder="Search day, topic..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 sm:w-48"
          />
          <label htmlFor="history-sort" className="sr-only">
            Sort entries
          </label>
          <select
            id="history-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as HistorySort)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {filtered.length} {filtered.length === 1 ? "entry" : "entries"} found
      </p>

      {/* History List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {items.length === 0
              ? "No journal entries yet. Start your first journal to build your learning record."
              : "No entries match your filters."}
          </p>
          {items.length === 0 && (
            <Link
              href="/journal"
              className="mt-4 inline-flex items-center rounded-lg bg-[#0F172A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e293b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] dark:bg-zinc-100 dark:text-[#0F172A]"
            >
              Start Today&apos;s Journal
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.day_number}
              className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {/* Header */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[#111827] dark:text-zinc-50">
                      Day {item.day_number} / {brand.totalDays}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status]}`}
                      role="status"
                    >
                      {item.status === "completed" ? "Completed" : "Draft"}
                    </span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {formatHistoryDate(item.updated_at)}
                    </span>
                  </div>

                  {/* Topic */}
                  <h3 className="mt-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {item.topic}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Module {item.module_number} — {item.module_title}
                  </p>

                  {/* Preview */}
                  <div className="mt-3 space-y-1.5">
                    {item.what_i_learned && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        <span className="font-medium">Learned:</span>{" "}
                        {truncateText(item.what_i_learned, 120)}
                      </p>
                    )}
                    {item.key_takeaway && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        <span className="font-medium">Key takeaway:</span>{" "}
                        {truncateText(item.key_takeaway, 120)}
                      </p>
                    )}
                    {item.what_i_built && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        <span className="font-medium">Built:</span>{" "}
                        {truncateText(item.what_i_built, 120)}
                      </p>
                    )}
                    {item.confidence_level !== null && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Confidence: {item.confidence_level} / 5 —{" "}
                        {CONFIDENCE_LABELS[item.confidence_level] ?? ""}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action */}
                <Link
                  href={`/journal?day=${item.day_number}`}
                  className="flex-shrink-0 rounded-md bg-[#0F172A] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1e293b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] dark:bg-zinc-100 dark:text-[#0F172A] dark:hover:bg-zinc-200"
                >
                  {item.status === "completed" ? "View Journal" : "Continue Journal"}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
