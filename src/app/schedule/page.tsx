import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth";
import { listUserSchedules } from "@/services/scheduling";
import { ScheduleList } from "@/components/schedule/schedule-list";

export const metadata: Metadata = {
  title: "Schedule",
};

export default async function SchedulePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const schedules = await listUserSchedules();

  const scheduled = schedules.filter((s) => s.status === "scheduled").length;
  const published = schedules.filter((s) => s.status === "published").length;
  const failed = schedules.filter((s) => s.status === "failed").length;
  const cancelled = schedules.filter((s) => s.status === "cancelled").length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <nav aria-label="Breadcrumb" className="mb-2 text-sm">
          <span aria-current="page" className="text-zinc-900 dark:text-zinc-50">
            Schedule
          </span>
        </nav>
        <h1 className="text-2xl font-bold text-[#111827] dark:text-zinc-50">
          Scheduled Posts
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Plan when approved posts are published. Scheduled posts publish
          automatically via the cron publisher.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Overview
        </h2>
        <div className="mt-3 flex flex-wrap gap-6">
          <div>
            <p className="text-2xl font-bold text-[#111827] dark:text-zinc-50">
              {schedules.length}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              total schedules
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold text-indigo-500 dark:text-indigo-400">
              {scheduled}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              upcoming
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-500 dark:text-emerald-400">
              {published}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              published
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-500 dark:text-red-400">
              {failed}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">failed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-zinc-400 dark:text-zinc-500">
              {cancelled}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              cancelled
            </p>
          </div>
        </div>
      </div>

      <ScheduleList schedules={schedules} />
    </div>
  );
}