import type { CurriculumProgress } from "@/types/curriculum";

type OverallProgressProps = {
  progress: CurriculumProgress;
};

export function OverallProgress({ progress }: OverallProgressProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Your Progress
          </h2>
          <p className="mt-1 text-2xl font-bold text-[#111827] dark:text-zinc-50">
            {progress.completed_days} / {progress.total_days} days completed
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-[#2563EB]">
            {progress.percentage}%
          </p>
        </div>
      </div>

      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-zinc-200">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${progress.percentage}%`,
            background: "linear-gradient(90deg, #2563EB, #06B6D4)",
          }}
        />
      </div>
    </div>
  );
}
