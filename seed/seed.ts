import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";

import { modules, curriculumDays } from "./curriculum";

// ─── Configuration ──────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Validation ─────────────────────────────────────────────────────────────

function validateCurriculum(): void {
  const dayNumbers = curriculumDays.map((d) => d.day_number);
  const uniqueDays = new Set(dayNumbers);

  // Check total count
  if (curriculumDays.length !== 105) {
    throw new Error(
      `Expected 105 curriculum days, got ${curriculumDays.length}`,
    );
  }

  // Check all days 1–105 exist
  for (let i = 1; i <= 105; i++) {
    if (!uniqueDays.has(i)) {
      throw new Error(`Missing day ${i}`);
    }
  }

  // Check no duplicates
  if (uniqueDays.size !== dayNumbers.length) {
    throw new Error(
      `Duplicate day numbers found. Expected 105 unique, got ${uniqueDays.size}`,
    );
  }

  // Check each day belongs to a valid module
  const moduleNumbers = new Set(modules.map((m) => m.module_number));
  for (const day of curriculumDays) {
    if (!moduleNumbers.has(day.module_number)) {
      throw new Error(
        `Day ${day.day_number} references invalid module ${day.module_number}`,
      );
    }
  }

  // Check day ranges match module ranges
  for (const mod of modules) {
    const modDays = curriculumDays
      .filter((d) => d.module_number === mod.module_number)
      .map((d) => d.day_number)
      .sort((a, b) => a - b);

    if (modDays[0] !== mod.start_day) {
      throw new Error(
        `Module ${mod.module_number} start_day mismatch: expected ${mod.start_day}, got ${modDays[0]}`,
      );
    }

    if (modDays[modDays.length - 1] !== mod.end_day) {
      throw new Error(
        `Module ${mod.module_number} end_day mismatch: expected ${mod.end_day}, got ${modDays[modDays.length - 1]}`,
      );
    }

    if (modDays.length !== mod.days) {
      throw new Error(
        `Module ${mod.module_number} day count mismatch: expected ${mod.days}, got ${modDays.length}`,
      );
    }
  }

  // Check subtopics are arrays
  for (const day of curriculumDays) {
    if (!Array.isArray(day.subtopics)) {
      throw new Error(
        `Day ${day.day_number} has invalid subtopics (not an array)`,
      );
    }
  }

  console.log("✓ Validation passed: 105 days, 8 modules, all ranges correct");
}

// ─── Seed Functions ─────────────────────────────────────────────────────────

async function seedModules(): Promise<void> {
  console.log("Seeding modules...");

  for (const mod of modules) {
    const { error } = await supabase.from("modules").upsert(
      {
        module_number: mod.module_number,
        title: mod.title,
        description: mod.description,
        weeks: mod.weeks,
        days: mod.days,
        hours: mod.hours,
        start_day: mod.start_day,
        end_day: mod.end_day,
      },
      { onConflict: "module_number" },
    );

    if (error) {
      throw new Error(
        `Failed to seed module ${mod.module_number}: ${error.message}`,
      );
    }
  }

  console.log(`✓ ${modules.length} modules seeded`);
}

async function seedDays(): Promise<void> {
  console.log("Seeding curriculum days...");

  // Look up module IDs
  const { data: moduleRows, error: fetchError } = await supabase
    .from("modules")
    .select("id, module_number");

  if (fetchError || !moduleRows) {
    throw new Error(`Failed to fetch modules: ${fetchError?.message}`);
  }

  const moduleIdMap = new Map<number, string>(
    moduleRows.map((m) => [m.module_number, m.id]),
  );

  // Seed days in batches of 20 for efficiency
  const batchSize = 20;

  for (let i = 0; i < curriculumDays.length; i += batchSize) {
    const batch = curriculumDays.slice(i, i + batchSize);

    const rows = batch.map((day) => ({
      day_number: day.day_number,
      module_id: moduleIdMap.get(day.module_number)!,
      week_number: day.week_number,
      topic: day.topic,
      content: day.content,
      subtopics: day.subtopics,
      project_information: day.project_information,
      assessment_information: day.assessment_information,
    }));

    const { error } = await supabase
      .from("curriculum_days")
      .upsert(rows, { onConflict: "day_number" });

    if (error) {
      throw new Error(
        `Failed to seed days batch ${Math.floor(i / batchSize) + 1}: ${error.message}`,
      );
    }
  }

  console.log(`✓ ${curriculumDays.length} curriculum days seeded`);
}

async function verifySeed(): Promise<void> {
  console.log("\nVerifying seed...");

  const { count, error: countError } = await supabase
    .from("curriculum_days")
    .select("*", { count: "exact", head: true });

  if (countError) {
    throw new Error(`Failed to count days: ${countError.message}`);
  }

  if (count !== 105) {
    throw new Error(
      `Verification failed: expected 105 days, found ${count}`,
    );
  }

  // Verify no gaps
  const { data: days } = await supabase
    .from("curriculum_days")
    .select("day_number")
    .order("day_number");

  if (!days) {
    throw new Error("Failed to fetch days for verification");
  }

  const dayNumbers = days.map((d) => d.day_number);
  for (let i = 1; i <= 105; i++) {
    if (dayNumbers[i - 1] !== i) {
      throw new Error(`Gap found: expected day ${i}, got ${dayNumbers[i - 1]}`);
    }
  }

  // Verify module relationships
  const { data: orphanDays } = await supabase
    .from("curriculum_days")
    .select("day_number, module_id")
    .is("module_id", null);

  if (orphanDays && orphanDays.length > 0) {
    throw new Error(
      `Found ${orphanDays.length} days without a module relationship`,
    );
  }

  console.log("✓ Verification passed: 105 days, no gaps, all relationships valid");
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════════");
  console.log("  105-Day Curriculum Seed Script");
  console.log("═══════════════════════════════════════════════════\n");

  validateCurriculum();
  await seedModules();
  await seedDays();
  await verifySeed();

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Seed complete!");
  console.log("═══════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
