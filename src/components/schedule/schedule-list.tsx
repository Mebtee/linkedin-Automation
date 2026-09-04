"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { cancelScheduleAction } from "@/app/actions/schedules";
import { ScheduleStatusBadge } from "@/components/schedule/schedule-status-badge";
import { formatDisplayDate } from "@/components/posts/schedule-panel";
import { EmptyState } from "@/components/ui/empty-state";
import type { ScheduleStatus, ScheduleWithPost } from "@/types/schedule";

const STATUS_FILTERS: Array<{
  label: string;
  value: ScheduleStatus | "all";
}> = [
  { label: "All", value: "all" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Publishing", value: "publishing" },
  { label: "Published", value: "published" },
  { label: "Failed", value: "failed" },
  { label: "Cancelled", value: "cancelled" },
];

type ScheduleListProps = {
  schedules: ScheduleWithPost[];
};

function truncate(text: string, max = 80): string {
  const plain = text.trim().replace(/\s+/g, " ");
  return plain.length > max ? `${plain.slice(0, max).trimEnd()}…` : plain;
}

export function ScheduleList({ schedules }: ScheduleListProps) {
  const [items, setItems] = useState(schedules);
  const [statusFilter, setStatusFilter] = useState<ScheduleStatus | "all">(
    "all",
  );
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = items;

    if (statusFilter !== "all") {
      result = result.filter((s) => s.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          String(s.post?.day_number ?? "").includes(q) ||
          (s.post?.opening ?? "").toLowerCase().includes(q) ||
          (s.post?.status ?? "").toLowerCase().includes(q),
      );
    }

    return result;
  }, [items, statusFilter, search]);

  const handleCancel = async (scheduleId: string) => {
    setPendingId(scheduleId);
    setError(null);
    const result = await cancelScheduleAction(scheduleId);
    setPendingId(null);
    if (!result.success) {
      setError(result.error.message);
      return;
    }
    setItems((prev) =>
      prev.map((s) => (s.id === scheduleId ? { ...s, status: "cancelled" } : s)),
    );
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              aria-pressed={statusFilter === f.value}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-[#0F172A] text-white dark:bg-zinc-100 dark:text-[#0F172A]"
                  : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search schedules..."
          aria-label="Search schedules"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 sm:w-64"
        />
      </div>

      {filtered.length === 0 ? (
        items.length === 0 ? (
          <EmptyState
            title="No scheduled posts"
            description="Open an approved post and use the Schedule panel to pick a date and time. Scheduled posts publish automatically."
          >
            <Link
              href="/posts"
              className="mt-4 inline-block rounded-lg bg-[#0a66c2] px-4 py-2 text-sm font-medium text-white hover:bg-[#004182] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
            >
              Go to Posts
            </Link>
          </EmptyState>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No schedules match your current filters.
            </p>
          </div>
        )
      ) : (
        <ul className="space-y-3">
          {filtered.map((schedule) => (
            <li
              key={schedule.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ScheduleStatusBadge status={schedule.status} />
                    {schedule.post && (
                      <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                        Post: {schedule.post.status}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                    {formatDisplayDate(schedule.scheduled_at)}
                  </p>
                  {schedule.post ? (
                    <p className="mt-1 truncate text-sm text-zinc-500 dark:text-zinc-400">
                      Day {schedule.post.day_number} —{" "}
                      {truncate(schedule.post.opening)}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
                      Associated post unavailable
                    </p>
                  )}
                  {schedule.last_error && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {schedule.last_error}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 gap-2">
                  {schedule.post && (
                    <Link
                      href={`/posts/${schedule.post.id}`}
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      Open Post
                    </Link>
                  )}
                  {schedule.status === "scheduled" && (
                    <button
                      type="button"
                      onClick={() => handleCancel(schedule.id)}
                      disabled={pendingId === schedule.id}
                      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-800 dark:bg-zinc-800 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      {pendingId === schedule.id ? "Cancelling…" : "Cancel"}
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}