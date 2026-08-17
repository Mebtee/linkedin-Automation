import { brand } from "@/config/brand";

export type DayProgress = {
  currentDay: number;
  totalDays: number;
  percentage: number;
  weekNumber: number;
  journeyStarted: boolean;
};

export type Profile = {
  id: string;
  display_name: string | null;
  timezone: string;
  journey_start_date: string | null;
  current_day: number;
  created_at: string;
  updated_at: string;
};

export type CurriculumDayRow = {
  id: string;
  day_number: number;
  module_id: string;
  week_number: number | null;
  topic: string;
  content: string | null;
  subtopics: string[] | null;
  project_information: string | null;
  assessment_information: string | null;
  created_at: string;
  updated_at: string;
};

export type ModuleRow = {
  id: string;
  module_number: number;
  title: string;
  description: string | null;
  weeks: number | null;
  days: number | null;
  hours: number | null;
  start_day: number;
  end_day: number;
  created_at: string;
  updated_at: string;
};

/**
 * Calculates the current day of the journey based on the user's timezone.
 *
 * current_day = (today - journey_start_date) + 1
 *
 * Returns null if journey_start_date is missing or in the future.
 */
export function calculateCurrentDay(
  journeyStartDate: string | null,
  timezone: string = brand.timezone,
): number | null {
  if (!journeyStartDate) return null;

  const now = new Date();
  const start = new Date(journeyStartDate);

  // Get today's date in the user's timezone
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD
  const startStr = start.toLocaleDateString("en-CA", { timeZone: timezone });

  const today = new Date(todayStr);
  const startDate = new Date(startStr);

  if (today < startDate) return null;

  const diffMs = today.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const currentDay = diffDays + 1;

  return currentDay;
}

/**
 * Calculates the current day from the profile's current_day column.
 * Falls back to journey_start_date calculation if current_day seems stale.
 */
export function getDayFromProfile(profile: Profile): DayProgress {
  let currentDay = profile.current_day;

  // Also calculate from start date to verify/update
  const calculated = calculateCurrentDay(profile.journey_start_date, profile.timezone);

  // Use the calculated value if it's valid and within range
  if (calculated !== null && calculated >= 1 && calculated <= brand.totalDays) {
    currentDay = calculated;
  }

  // Clamp to valid range
  currentDay = Math.max(1, Math.min(currentDay, brand.totalDays));

  const percentage = Math.round((currentDay / brand.totalDays) * 100);
  const weekNumber = Math.ceil(currentDay / 7);

  return {
    currentDay,
    totalDays: brand.totalDays,
    percentage,
    weekNumber,
    journeyStarted: profile.journey_start_date !== null,
  };
}
