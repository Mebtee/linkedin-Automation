import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { brand } from "@/config/brand";
import { getDayFromProfile } from "@/services/curriculum";
import type { Profile, CurriculumDayRow, ModuleRow } from "@/services/curriculum";

import { ProgressBar } from "@/components/dashboard/progress-bar";
import { StatCard } from "@/components/dashboard/stat-card";
import { TopicCard } from "@/components/dashboard/topic-card";
import { ModuleBadge } from "@/components/dashboard/module-badge";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) redirect("/login");

  const typedProfile = profile as Profile;

  // Calculate day progress
  const progress = getDayFromProfile(typedProfile);

  // Fetch current day curriculum
  const { data: currentDayData } = await supabase
    .from("curriculum_days")
    .select("*")
    .eq("day_number", progress.currentDay)
    .single();

  const currentDay = currentDayData as CurriculumDayRow | null;

  // Fetch current module
  let currentModule: ModuleRow | null = null;
  if (currentDay) {
    const { data } = await supabase
      .from("modules")
      .select("*")
      .eq("id", currentDay.module_id)
      .single();
    currentModule = (data as ModuleRow) ?? null;
  }

  // Fetch next day (if available)
  let nextDay: CurriculumDayRow | null = null;
  let nextModule: ModuleRow | null = null;
  if (progress.currentDay < brand.totalDays) {
    const { data } = await supabase
      .from("curriculum_days")
      .select("*")
      .eq("day_number", progress.currentDay + 1)
      .single();
    nextDay = (data as CurriculumDayRow) ?? null;
    if (nextDay) {
      const { data: mod } = await supabase
        .from("modules")
        .select("*")
        .eq("id", nextDay.module_id)
        .single();
      nextModule = (mod as ModuleRow) ?? null;
    }
  }

  // Fetch previous day (if available)
  let prevDay: CurriculumDayRow | null = null;
  if (progress.currentDay > 1) {
    const { data } = await supabase
      .from("curriculum_days")
      .select("*")
      .eq("day_number", progress.currentDay - 1)
      .single();
    prevDay = (data as CurriculumDayRow) ?? null;
  }

  // Format dates
  const startDate = typedProfile.journey_start_date
    ? new Date(typedProfile.journey_start_date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: typedProfile.timezone,
      })
    : null;

  return (
    <div className="space-y-8">
      {/* Series Title */}
      <div className="text-center">
        <h1 className="text-xs font-bold uppercase tracking-[0.2em] text-[#06B6D4]">
          {brand.series}
        </h1>
      </div>

      {/* Current Day Hero */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Current Day</p>
        <p className="mt-1 text-5xl font-bold text-[#0F172A] dark:text-zinc-50">
          Day {progress.currentDay}
          <span className="text-lg font-normal text-zinc-400"> / {progress.totalDays}</span>
        </p>
        {startDate && (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Started {startDate}
          </p>
        )}
      </div>

      {/* Progress Bar */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <ProgressBar
          current={progress.currentDay}
          total={progress.totalDays}
          percentage={progress.percentage}
        />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Progress" value={`${progress.percentage}%`} accent />
        <StatCard label="Week" value={progress.weekNumber} />
        <StatCard label="Days Left" value={progress.totalDays - progress.currentDay} />
        {currentModule && (
          <StatCard label="Module" value={`${currentModule.module_number} / 8`} />
        )}
      </div>

      {/* Current Module */}
      {currentModule && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Current Module
          </h2>
          <ModuleBadge
            moduleNumber={currentModule.module_number}
            title={currentModule.title}
            dayRange={`Days ${currentModule.start_day}–${currentModule.end_day}`}
          />
        </div>
      )}

      {/* Today's Topic */}
      {currentDay && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Today&apos;s Learning
          </h2>
          <TopicCard
            dayNumber={currentDay.day_number}
            topic={currentDay.topic}
            content={currentDay.content}
            subtopics={currentDay.subtopics}
            label="Today"
          />
        </div>
      )}

      {/* Next Day Preview */}
      {nextDay && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Up Next
          </h2>
          <TopicCard
            dayNumber={nextDay.day_number}
            topic={nextDay.topic}
            content={nextDay.content}
            subtopics={nextDay.subtopics}
            label={nextModule ? `Module ${nextModule.module_number}` : ""}
            muted
          />
        </div>
      )}

      {/* Previous Day */}
      {prevDay && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Previous Day
          </h2>
          <TopicCard
            dayNumber={prevDay.day_number}
            topic={prevDay.topic}
            content={prevDay.content}
            subtopics={prevDay.subtopics}
            label="Completed"
            muted
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/curriculum"
          className="inline-flex items-center justify-center rounded-lg bg-[#0F172A] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1e293b] dark:bg-zinc-50 dark:text-[#0F172A] dark:hover:bg-zinc-200"
        >
          View Curriculum
        </Link>
        <Link
          href="/journal"
          className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-[#111827] transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
        >
          Today&apos;s Journal
        </Link>
      </div>
    </div>
  );
}
