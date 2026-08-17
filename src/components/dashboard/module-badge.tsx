type ModuleBadgeProps = {
  moduleNumber: number;
  title: string;
  dayRange: string;
};

export function ModuleBadge({ moduleNumber, title, dayRange }: ModuleBadgeProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#0F172A] text-sm font-bold text-white">
        M{moduleNumber}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[#111827] dark:text-zinc-50">
          {title}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{dayRange}</p>
      </div>
    </div>
  );
}
