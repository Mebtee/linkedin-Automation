import type { JournalEntryStatus } from "@/types/journal";

/**
 * Filter options for journal history.
 */
export type HistoryFilter = "all" | "completed" | "draft" | "not_started";

/**
 * Sort order for journal history.
 */
export type HistorySort = "newest" | "oldest";

/**
 * A journal entry enriched with curriculum data for the history view.
 */
export type JournalHistoryItem = {
  day_number: number;
  topic: string;
  module_number: number;
  module_title: string;
  status: "completed" | "draft";
  what_i_learned: string | null;
  key_takeaway: string | null;
  what_i_built: string | null;
  confidence_level: number | null;
  updated_at: string;
};

/**
 * Summary statistics for the journal history page.
 */
export type JournalHistorySummary = {
  total_days: number;
  completed_days: number;
  draft_days: number;
  not_started_days: number;
  percentage: number;
};

/**
 * Curriculum day without a journal entry (for "Not Started" filter).
 */
export type CurriculumDayWithoutJournal = {
  day_number: number;
  topic: string;
  module_number: number;
  module_title: string;
};

/**
 * Maps a database journal status to a history display status.
 */
export function toHistoryStatus(
  status: JournalEntryStatus,
): "completed" | "draft" {
  if (status === "submitted" || status === "used") return "completed";
  return "draft";
}

/**
 * Formats a timestamp for display.
 */
export function formatHistoryDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Truncates text to a maximum length with ellipsis.
 */
export function truncateText(text: string | null, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "...";
}

/**
 * Calculates summary statistics from history items.
 */
export function calculateHistorySummary(
  items: JournalHistoryItem[],
): JournalHistorySummary {
  const completed = items.filter((i) => i.status === "completed").length;
  const drafts = items.filter((i) => i.status === "draft").length;
  return {
    total_days: 105,
    completed_days: completed,
    draft_days: drafts,
    not_started_days: 105 - completed - drafts,
    percentage: Math.floor((completed / 105) * 100),
  };
}
