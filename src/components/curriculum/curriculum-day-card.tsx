import Link from "next/link";

import type { CurriculumDayWithStatus } from "@/types/curriculum";
import { dayStatusLabel, journalActionLabel } from "@/services/curriculum";

type CurriculumDayCardProps = {
  day: CurriculumDayWithStatus;
};

const STATUS_STYLES = {
  completed:
    "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20",
  draft: "border-[#2563EB]/20 bg-[#2563EB]/5 dark:border-[#2563EB]/30 dark:bg-[#2563EB]/10",
  not_started:
    "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
} as const;

const STATUS_BADGE = {
  completed:
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  draft: "bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#2563EB]/20 dark:text-[#2563EB]",
  not_started:
    "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
} as const;

export function CurriculumDayCard({ day }: CurriculumDayCardProps) {
  const label = dayStatusLabel(day.dayStatus);
  const action = journalActionLabel(day.dayStatus);

  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${STATUS_STYLES[day.dayStatus]} ${
        day.isToday ? "ring-2 ring-[#06B6D4] ring-offset-2" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Day {day.day_number}
            </span>
            {day.isToday && (
              <span className="inline-flex items-center rounded-full bg-[#06B6D4]/10 px-2 py-0.5 text-xs font-semibold text-[#06B6D4]">
                TODAY
              </span>
            )}
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[day.dayStatus]}`}
            >
              {label}
            </span>
          </div>
          <h3 className="mt-1 text-sm font-semibold text-[#111827] dark:text-zinc-50">
            {day.topic}
          </h3>
          {day.content && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
              {day.content}
            </p>
          )}
          {day.subtopics && day.subtopics.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {day.subtopics.slice(0, 3).map((sub) => (
                <span
                  key={sub}
                  className="inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                >
                  {sub}
                </span>
              ))}
              {day.subtopics.length > 3 && (
                <span className="text-[10px] text-zinc-400">
                  +{day.subtopics.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>

        <Link
          href={`/journal?day=${day.day_number}`}
          className="flex-shrink-0 rounded-md bg-[#0F172A] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1e293b] dark:bg-zinc-100 dark:text-[#0F172A] dark:hover:bg-zinc-200"
        >
          {action}
        </Link>
      </div>
    </div>
  );
}
