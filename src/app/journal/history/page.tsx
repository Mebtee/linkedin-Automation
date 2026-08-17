import { redirect } from "next/navigation";
import Link from "next/link";

import { getUser } from "@/lib/auth";
import { brand } from "@/config/brand";
import { getJournalHistoryItems, calculateHistorySummary } from "@/services/journal/history";
import { JournalHistoryList } from "@/components/journal/journal-history-list";

export const metadata = {
  title: "Journal History",
};

export default async function JournalHistoryPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const items = await getJournalHistoryItems();
  const summary = calculateHistorySummary(items);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <nav aria-label="Breadcrumb" className="mb-2 text-sm">
          <Link
            href="/journal"
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Journal
          </Link>
          <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">/</span>
          <span aria-current="page" className="text-zinc-900 dark:text-zinc-50">
            History
          </span>
        </nav>
        <h1 className="text-2xl font-bold text-[#111827] dark:text-zinc-50">
          Journal History
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Review your {brand.totalDays}-day learning journey.
        </p>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Your Learning Journey
        </h2>
        <div className="mt-3 flex flex-wrap gap-6">
          <div>
            <p className="text-2xl font-bold text-[#111827] dark:text-zinc-50">
              {summary.completed_days} / {summary.total_days}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">completed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#2563EB]">
              {summary.draft_days}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">drafts</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-zinc-400 dark:text-zinc-500">
              {summary.not_started_days}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">days remaining</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${summary.percentage}%`,
              background: "linear-gradient(90deg, #2563EB, #06B6D4)",
            }}
          />
        </div>
      </div>

      {/* List */}
      <JournalHistoryList items={items} />
    </div>
  );
}
