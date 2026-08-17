import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { brand } from "@/config/brand";
import { getDayFromProfile } from "@/services/curriculum";
import type { Profile, CurriculumDayRow, ModuleRow } from "@/services/curriculum";
import {
  buildJournalStatusMap,
  enrichCurriculumDays,
  calculateCurriculumProgress,
  calculateModuleProgress,
} from "@/services/curriculum/integration";

import { CurriculumDayCard } from "@/components/curriculum/curriculum-day-card";
import { ModuleProgressCard } from "@/components/curriculum/module-progress-card";
import { OverallProgress } from "@/components/curriculum/overall-progress";
import type { CurriculumDayWithStatus } from "@/types/curriculum";

export const metadata: Metadata = {
  title: "Curriculum",
};

export default async function CurriculumPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const typedProfile = profile as Profile;
  const progress = getDayFromProfile(typedProfile);

  // Fetch all curriculum days
  const { data: allDays } = await supabase
    .from("curriculum_days")
    .select("*")
    .order("day_number", { ascending: true });

  const curriculumDays = (allDays as CurriculumDayRow[]) ?? [];

  // Fetch all modules
  const { data: allModules } = await supabase
    .from("modules")
    .select("*")
    .order("module_number", { ascending: true });

  const modules = (allModules as ModuleRow[]) ?? [];

  // Fetch ALL user journal entries (one efficient query)
  const { data: journalEntries } = await supabase
    .from("daily_learning_entries")
    .select("day_number, status")
    .eq("profile_id", user.id);

  const journalMap = buildJournalStatusMap(
    (journalEntries as { day_number: number; status: "draft" | "submitted" | "used" }[]) ?? [],
  );

  // Calculate progress
  let submittedCount = 0;
  for (const [, status] of journalMap) {
    if (status === "submitted" || status === "used") submittedCount++;
  }

  const curriculumProgress = calculateCurriculumProgress(
    submittedCount,
    progress.currentDay,
  );

  // Enrich days with status
  const enrichedDays = enrichCurriculumDays(
    curriculumDays,
    modules,
    journalMap,
    progress.currentDay,
  );

  // Calculate module progress
  const moduleProgressList = modules.map((mod) =>
    calculateModuleProgress(mod, journalMap, progress.currentDay),
  );

  // Group days by module
  const daysByModule = new Map<number, CurriculumDayWithStatus[]>();
  for (const day of enrichedDays) {
    const list = daysByModule.get(day.module_number) ?? [];
    list.push(day);
    daysByModule.set(day.module_number, list);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#06B6D4]">
          {brand.series}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[#111827] dark:text-zinc-50">
          Curriculum
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {brand.totalDays} days of structured learning. Your journal tracks what you complete.
        </p>
      </div>

      {/* Overall Progress */}
      <OverallProgress progress={curriculumProgress} />

      {/* Module Progress */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Module Progress
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {moduleProgressList.map((mod) => (
            <ModuleProgressCard key={mod.module_number} module={mod} />
          ))}
        </div>
      </div>

      {/* Curriculum Days by Module */}
      {moduleProgressList.map((mod) => {
        const days = daysByModule.get(mod.module_number) ?? [];
        if (days.length === 0) return null;

        return (
          <div key={mod.module_number}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Module {mod.module_number}
              </h2>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                — {mod.title}
              </span>
            </div>
            <div className="grid gap-2">
              {days.map((day) => (
                <CurriculumDayCard key={day.day_number} day={day} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Navigation */}
      <div className="flex gap-3">
        <Link
          href="/dashboard"
          className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          Back to Dashboard
        </Link>
        <Link
          href={`/journal?day=${progress.currentDay}`}
          className="rounded-lg bg-[#0F172A] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1e293b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] dark:bg-zinc-100 dark:text-[#0F172A] dark:hover:bg-zinc-200"
        >
          Today&apos;s Journal
        </Link>
      </div>
    </div>
  );
}
