import type { ScheduleStatus } from "@/types/schedule";

type ScheduleStatusBadgeProps = {
  status: ScheduleStatus;
};

const STATUS_META: Record<
  ScheduleStatus,
  { label: string; className: string }
> = {
  scheduled: {
    label: "Scheduled",
    className:
      "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  },
  publishing: {
    label: "Publishing",
    className:
      "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  published: {
    label: "Published",
    className:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  failed: {
    label: "Failed",
    className: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  cancelled: {
    label: "Cancelled",
    className:
      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
};

export function ScheduleStatusBadge({ status }: ScheduleStatusBadgeProps) {
  const meta = STATUS_META[status];
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.className}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}