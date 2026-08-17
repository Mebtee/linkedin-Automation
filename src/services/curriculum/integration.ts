import { brand } from "@/config/brand";
import type { JournalEntryStatus } from "@/types/journal";
import {
  toDayStatus,
  type DayStatus,
  type CurriculumDayWithStatus,
  type ModuleProgress,
  type CurriculumProgress,
  type TodayLearning,
} from "@/types/curriculum";
import type { CurriculumDayRow, ModuleRow } from "./dayProgress";

export { toDayStatus };

/**
 * Builds a map of day_number → journal status from an array of journal entries.
 * Efficient: one query produces the full map.
 */
export function buildJournalStatusMap(
  entries: { day_number: number; status: JournalEntryStatus }[],
): Map<number, JournalEntryStatus> {
  const map = new Map<number, JournalEntryStatus>();
  for (const entry of entries) {
    map.set(entry.day_number, entry.status);
  }
  return map;
}

/**
 * Enriches curriculum days with journal status and module info.
 */
export function enrichCurriculumDays(
  days: CurriculumDayRow[],
  modules: ModuleRow[],
  journalMap: Map<number, JournalEntryStatus>,
  currentDay: number,
): CurriculumDayWithStatus[] {
  const moduleMap = new Map(modules.map((m) => [m.id, m]));

  return days.map((day) => {
    const mod = moduleMap.get(day.module_id);
    const status = journalMap.get(day.day_number) ?? null;

    return {
      day_number: day.day_number,
      topic: day.topic,
      content: day.content,
      subtopics: day.subtopics,
      module_id: day.module_id,
      module_number: mod?.module_number ?? 0,
      module_title: mod?.title ?? "",
      week_number: day.week_number,
      dayStatus: toDayStatus(status),
      isToday: day.day_number === currentDay,
    };
  });
}

/**
 * Calculates overall curriculum progress from journal entries.
 */
export function calculateCurriculumProgress(
  submittedDays: number,
  currentDay: number,
): CurriculumProgress {
  const totalDays = brand.totalDays;
  const percentage =
    totalDays > 0 ? Math.round((submittedDays / totalDays) * 100) : 0;

  return {
    total_days: totalDays,
    completed_days: submittedDays,
    percentage,
    currentDay,
    currentModule: Math.ceil(currentDay / 7),
  };
}

/**
 * Calculates progress for a specific module.
 */
export function calculateModuleProgress(
  module: ModuleRow,
  journalMap: Map<number, JournalEntryStatus>,
  currentDay: number,
): ModuleProgress {
  let completedDays = 0;

  for (let d = module.start_day; d <= module.end_day; d++) {
    const status = journalMap.get(d);
    if (status === "submitted" || status === "used") {
      completedDays++;
    }
  }

  const totalDays = module.end_day - module.start_day + 1;
  const isCurrent =
    currentDay >= module.start_day && currentDay <= module.end_day;

  return {
    module_number: module.module_number,
    title: module.title,
    start_day: module.start_day,
    end_day: module.end_day,
    total_days: totalDays,
    completed_days: completedDays,
    is_complete: completedDays === totalDays,
    is_current: isCurrent,
  };
}

/**
 * Prepares today's learning data for the dashboard.
 */
export function buildTodayLearning(
  currentDay: CurriculumDayRow | null,
  currentModule: ModuleRow | null,
  dayStatus: DayStatus,
): TodayLearning | null {
  if (!currentDay) return null;

  return {
    day_number: currentDay.day_number,
    topic: currentDay.topic,
    content: currentDay.content,
    module_number: currentModule?.module_number ?? 0,
    module_title: currentModule?.title ?? "",
    dayStatus,
  };
}

/**
 * Returns a user-friendly label for a day status.
 */
export function dayStatusLabel(status: DayStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "draft":
      return "Draft";
    case "not_started":
      return "Not started";
  }
}

/**
 * Returns the appropriate journal action label for a day.
 */
export function journalActionLabel(status: DayStatus): string {
  switch (status) {
    case "completed":
      return "View Journal";
    case "draft":
      return "Continue Journal";
    case "not_started":
      return "Start Journal";
  }
}
