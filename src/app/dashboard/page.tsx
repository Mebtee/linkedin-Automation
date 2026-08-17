import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { brand } from "@/config/brand";
import { getDayFromProfile } from "@/services/curriculum";
import type { Profile, CurriculumDayRow, ModuleRow } from "@/services/curriculum";
import {
  buildJournalStatusMap,
  calculateCurriculumProgress,
  toDayStatus,
  dayStatusLabel,
  journalActionLabel,
} from "@/services/curriculum/integration";

import { StatCard } from "@/components/dashboard/stat-card";
import { TopicCard } from "@/components/dashboard/topic-card";
import { ModuleBadge } from "@/components/dashboard/module-badge";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) redirect("/login");

  const typedProfile = profile as Profile;
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

  // Fetch next day
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

  // Fetch previous day
  let prevDay: CurriculumDayRow | null = null;
  if (progress.currentDay > 1) {
    const { data } = await supabase
      .from("curriculum_days")
      .select("*")
      .eq("day_number", progress.currentDay - 1)
    .single();
    prevDay = (data as CurriculumDayRow) ?? null;
  }

  // Fetch ALL user journal entries for progress (one efficient query)
  const { data: journalEntries } = await supabase
    .from("daily_learning_entries")
    .select("day_number, status")
    .eq("profile_id", user.id);

  const journalMap = buildJournalStatusMap(
    (journalEntries as { day_number: number; status: "draft" | "submitted" | "used" }[]) ?? [],
  );

  // Calculate journal-based progress
  let submittedCount = 0;
  for (const [, status] of journalMap) {
    if (status === "submitted" || status === "used") submittedCount++;
  }

  const curriculumProgress = calculateCurriculumProgress(
    submittedCount,
    progress.currentDay,
  );

  // Today's journal status
  const todayStatus = toDayStatus(journalMap.get(progress.currentDay));
  const todayAction = journalActionLabel(todayStatus);
  const todayStatusLabelText = dayStatusLabel(todayStatus);

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
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-[#111827]">
            {submittedCount} / {progress.totalDays} days completed
          </span>
          <span className="font-semibold text-[#2563EB]">
            {curriculumProgress.percentage}%
          </span>
        </div>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-zinc-200">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${curriculumProgress.percentage}%`,
              background: "linear-gradient(90deg, #2563EB, #06B6D4)",
            }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Completed" value={`${submittedCount} / ${progress.totalDays}`} accent />
        <StatCard label="Week" value={progress.weekNumber} />
        <StatCard label="Days Left" value={progress.totalDays - progress.currentDay} />
        {currentModule && (
          <StatCard label="Module" value={`${currentModule.module_number} / ${brand.totalModules}`} />
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

      {/* Today's Topic with Journal Status */}
      {currentDay && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Today&apos;s Learning
          </h2>
          <div className="rounded-lg border border-[#2563EB]/20 bg-[#2563EB]/5 p-5 dark:border-[#2563EB]/30 dark:bg-[#2563EB]/10">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[#06B6D4]/10 px-2.5 py-0.5 text-xs font-medium text-[#06B6D4]">
                Day {currentDay.day_number}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {todayStatusLabelText}
              </span>
            </div>
            <h3 className="mt-2 text-lg font-semibold text-[#111827] dark:text-zinc-50">
              {currentDay.topic}
            </h3>
            {currentDay.content && (
              <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {currentDay.content}
              </p>
            )}
            {currentDay.subtopics && currentDay.subtopics.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {currentDay.subtopics.map((sub) => (
                  <span
                    key={sub}
                    className="inline-block rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  >
                    {sub}
                  </span>
                ))}
              </div>
            )}
            <Link
              href={`/journal?day=${currentDay.day_number}`}
              className="mt-4 inline-flex items-center rounded-lg bg-[#0F172A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1e293b] dark:bg-zinc-100 dark:text-[#0F172A] dark:hover:bg-zinc-200"
            >
              {todayAction}
            </Link>
          </div>
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
            label={dayStatusLabel(toDayStatus(journalMap.get(prevDay.day_number)))}
            muted
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/curriculum"
          className="inline-flex items-center justify-center rounded-lg bg-[#0F172A] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1e293b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] dark:bg-zinc-50 dark:text-[#0F172A] dark:hover:bg-zinc-200"
        >
          View Curriculum
        </Link>
        <Link
          href={`/journal?day=${progress.currentDay}`}
          className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-[#111827] transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
        >
          {todayAction}
        </Link>
      </div>
    </div>
  );
}
