type ProgressBarProps = {
  current: number;
  total: number;
  percentage: number;
};

export function ProgressBar({ current, total, percentage }: ProgressBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-[#111827]">
          {current} / {total} days
        </span>
        <span className="font-semibold text-[#2563EB]">{percentage}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-200">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${percentage}%`,
            background: `linear-gradient(90deg, #2563EB, #06B6D4)`,
          }}
        />
      </div>
    </div>
  );
}
