import type { ModuleProgress } from "@/types/curriculum";

type ModuleProgressCardProps = {
  module: ModuleProgress;
};

export function ModuleProgressCard({ module }: ModuleProgressCardProps) {
  const percentage =
    module.total_days > 0
      ? Math.round((module.completed_days / module.total_days) * 100)
      : 0;

  return (
    <div
      className={`rounded-lg border p-4 ${
        module.is_complete
          ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20"
          : module.is_current
            ? "border-[#2563EB]/20 bg-[#2563EB]/5 dark:border-[#2563EB]/30 dark:bg-[#2563EB]/10"
            : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
            module.is_complete
              ? "bg-green-600 text-white"
              : "bg-[#0F172A] text-white dark:bg-zinc-700"
          }`}
        >
          {module.is_complete ? "✓" : `M${module.module_number}`}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-[#111827] dark:text-zinc-50">
              {module.title}
            </p>
            {module.is_current && (
              <span className="inline-flex items-center rounded-full bg-[#06B6D4]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#06B6D4]">
                CURRENT
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Days {module.start_day}–{module.end_day}
          </p>
        </div>
        <div className="text-right">
          <p
            className={`text-sm font-semibold ${
              module.is_complete
                ? "text-green-600 dark:text-green-400"
                : "text-[#111827] dark:text-zinc-50"
            }`}
          >
            {module.completed_days} / {module.total_days}
          </p>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {percentage}%
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            module.is_complete
              ? "bg-green-500"
              : "bg-gradient-to-r from-[#2563EB] to-[#06B6D4]"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
