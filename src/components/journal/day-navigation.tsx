"use client";

type DayNavigationProps = {
  currentDay: number;
  totalDays: number;
  onNavigate: (day: number) => void;
};

export function DayNavigation({
  currentDay,
  totalDays,
  onNavigate,
}: DayNavigationProps) {
  const hasPrev = currentDay > 1;
  const hasNext = currentDay < totalDays;

  return (
    <div className="flex items-center justify-between" role="navigation" aria-label="Day navigation">
      <button
        type="button"
        onClick={() => hasPrev && onNavigate(currentDay - 1)}
        disabled={!hasPrev}
        aria-label="Previous day"
        className="flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        <span aria-hidden="true" className="text-zinc-400">&larr;</span>
        Previous Day
      </button>

      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-400" aria-current="page">
          Day {currentDay} / {totalDays}
        </span>
      </div>

      <button
        type="button"
        onClick={() => hasNext && onNavigate(currentDay + 1)}
        disabled={!hasNext}
        aria-label="Next day"
        className="flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        Next Day
        <span aria-hidden="true" className="text-zinc-400">&rarr;</span>
      </button>
    </div>
  );
}
