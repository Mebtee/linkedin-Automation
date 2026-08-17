import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { brand } from "@/config/brand";
import { getDayFromProfile } from "@/services/curriculum";
import type { Profile, CurriculumDayRow, ModuleRow } from "@/services/curriculum";
import { getJournalEntry } from "@/services/journal";

import { JournalForm } from "@/components/journal/journal-form";

export const metadata: Metadata = {
  title: "Journal",
};

type PageProps = {
  searchParams: Promise<{ day?: string }>;
};

export default async function JournalPage({ searchParams }: PageProps) {
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

  const params = await searchParams;
  const requestedDay = params.day ? parseInt(params.day, 10) : null;
  const dayNumber =
    requestedDay &&
    Number.isInteger(requestedDay) &&
    requestedDay >= 1 &&
    requestedDay <= brand.totalDays
      ? requestedDay
      : progress.currentDay;

  // Fetch curriculum day
  const { data: curriculumDayData } = await supabase
    .from("curriculum_days")
    .select("*")
    .eq("day_number", dayNumber)
    .single();

  const curriculumDay = curriculumDayData as CurriculumDayRow | null;

  // Fetch module if curriculum day exists
  let currentModule: ModuleRow | null = null;
  if (curriculumDay) {
    const { data: moduleData } = await supabase
      .from("modules")
      .select("*")
      .eq("id", curriculumDay.module_id)
      .single();
    currentModule = moduleData as ModuleRow | null;
  }

  // Fetch journal entry
  const entry = await getJournalEntry(dayNumber);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Link
          href="/journal/history"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          View Journal History
        </Link>
      </div>
      <JournalForm
        entry={entry}
        curriculumDay={curriculumDay}
        currentModule={currentModule}
        dayNumber={dayNumber}
        totalDays={brand.totalDays}
      />
    </div>
  );
}
