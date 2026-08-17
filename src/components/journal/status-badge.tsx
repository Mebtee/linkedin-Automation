import type { JournalEntryStatus } from "@/types/journal";

type StatusBadgeProps = {
  status: JournalEntryStatus;
};

const STATUS_CONFIG: Record<
  JournalEntryStatus,
  { label: string; description: string; className: string; indicator: string }
> = {
  draft: {
    label: "Draft",
    description: "You can keep editing.",
    className:
      "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    indicator: "\u2022",
  },
  submitted: {
    label: "Submitted",
    description: "Your learning record is saved.",
    className:
      "bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#2563EB]/20 dark:text-[#2563EB]",
    indicator: "\u2713",
  },
  used: {
    label: "Used",
    description: "Used by content generation.",
    className:
      "bg-[#06B6D4]/10 text-[#06B6D4] dark:bg-[#06B6D4]/20 dark:text-[#06B6D4]",
    indicator: "\u2713",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-2" role="status">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
      >
        <span aria-hidden="true">{config.indicator}</span>
        {config.label}
      </span>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        {config.description}
      </span>
    </div>
  );
}
