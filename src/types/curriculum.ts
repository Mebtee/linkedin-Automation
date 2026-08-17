import type { JournalEntryStatus } from "@/types/journal";

/**
 * User-facing day status derived from journal entry status.
 */
export type DayStatus = "not_started" | "draft" | "completed";

/**
 * Maps a database journal status to a user-facing day status.
 */
export function toDayStatus(
  journalStatus: JournalEntryStatus | null | undefined,
): DayStatus {
  if (journalStatus === "submitted" || journalStatus === "used")
    return "completed";
  if (journalStatus === "draft") return "draft";
  return "not_started";
}

/**
 * A curriculum day enriched with the user's journal status.
 */
export type CurriculumDayWithStatus = {
  day_number: number;
  topic: string;
  content: string | null;
  subtopics: string[] | null;
  module_id: string;
  module_number: number;
  module_title: string;
  week_number: number | null;
  dayStatus: DayStatus;
  isToday: boolean;
};

/**
 * Module-level progress summary.
 */
export type ModuleProgress = {
  module_number: number;
  title: string;
  start_day: number;
  end_day: number;
  total_days: number;
  completed_days: number;
  is_complete: boolean;
  is_current: boolean;
};

/**
 * Overall curriculum progress for the user.
 */
export type CurriculumProgress = {
  total_days: number;
  completed_days: number;
  percentage: number;
  currentDay: number;
  currentModule: number;
};

/**
 * Today's learning summary for the dashboard.
 */
export type TodayLearning = {
  day_number: number;
  topic: string;
  content: string | null;
  module_number: number;
  module_title: string;
  dayStatus: DayStatus;
};
