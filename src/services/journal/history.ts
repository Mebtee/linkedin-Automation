import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import type {
  JournalHistoryItem,
} from "@/types/journal-history";
import { toHistoryStatus, calculateHistorySummary } from "@/types/journal-history";

// Re-export for convenience (service layer API)
export { calculateHistorySummary };

/**
 * Module row from curriculum_modules table.
 */
type ModuleRow = {
  id: string;
  module_number: number;
  title: string;
};

/**
 * Journal entry row joined with curriculum_days.
 * Supabase returns the joined row as an array.
 */
type JournalRow = {
  day_number: number;
  status: string;
  what_i_learned: string | null;
  key_takeaway: string | null;
  what_i_built: string | null;
  confidence_level: number | null;
  updated_at: string;
  curriculum_days: {
    topic: string | null;
    module_id: string | null;
  }[];
};

/**
 * Fetches journal history for the authenticated user with curriculum data.
 * 2 queries (entries + modules) — no N+1 pattern.
 * Returns empty array if not authenticated.
 */
export async function getJournalHistoryItems(): Promise<JournalHistoryItem[]> {
  const user = await getUser();
  if (!user) return [];

  const supabase = await createClient();

  // Fetch user's journal entries with curriculum join
  const { data: entries } = await supabase
    .from("daily_learning_entries")
    .select(
      "day_number, status, what_i_learned, key_takeaway, what_i_built, confidence_level, updated_at, curriculum_days(topic, module_id)",
    )
    .eq("profile_id", user.id)
    .order("day_number", { ascending: false });

  if (!entries || entries.length === 0) return [];

  // Fetch all modules (small table — 8 rows)
  const { data: modules } = await supabase
    .from("curriculum_modules")
    .select("id, module_number, title")
    .order("module_number", { ascending: true });

  // Build module lookup: id → { module_number, title }
  const moduleMap = new Map<string, { module_number: number; title: string }>();
  for (const mod of (modules ?? []) as ModuleRow[]) {
    moduleMap.set(mod.id, {
      module_number: mod.module_number,
      title: mod.title,
    });
  }

  return (entries as unknown as JournalRow[]).map((row) => {
    const curr = row.curriculum_days?.[0];
    const moduleId = curr?.module_id ?? "";
    const mod = moduleMap.get(moduleId);
    return {
      day_number: row.day_number,
      topic: curr?.topic ?? "Unknown",
      module_number: mod?.module_number ?? 0,
      module_title: mod?.title ?? "Unknown",
      status: toHistoryStatus(
        row.status as "draft" | "submitted" | "used",
      ),
      what_i_learned: row.what_i_learned,
      key_takeaway: row.key_takeaway,
      what_i_built: row.what_i_built,
      confidence_level: row.confidence_level,
      updated_at: row.updated_at,
    };
  });
}
