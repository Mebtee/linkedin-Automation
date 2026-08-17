import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/utils/errors";
import type {
  JournalEntry,
  JournalEntryStatus,
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
  JournalEntryWithCurriculum,
} from "@/types/journal";
import {
  validateDayNumber,
  validateJournalInput,
  validateSubmission,
  validateStatusTransition,
} from "./validation";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the authenticated user or throws AUTH_REQUIRED.
 */
async function requireAuth(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ id: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("Authentication required.", { code: "AUTH_REQUIRED" });
  }

  return user;
}

/**
 * Loads a journal entry by ID and verifies ownership.
 * Throws JOURNAL_NOT_FOUND if not found or not owned by the user.
 */
async function loadOwnEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  entryId: string,
): Promise<JournalEntry> {
  const { data, error } = await supabase
    .from("daily_learning_entries")
    .select("*")
    .eq("id", entryId)
    .eq("profile_id", userId)
    .single();

  if (error || !data) {
    throw new AppError("Journal entry not found.", {
      code: "JOURNAL_NOT_FOUND",
    });
  }

  return data as JournalEntry;
}

/**
 * Verifies that a curriculum day exists.
 * Throws CURRICULUM_DAY_NOT_FOUND if it doesn't.
 */
async function requireCurriculumDay(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dayNumber: number,
): Promise<void> {
  const { count, error } = await supabase
    .from("curriculum_days")
    .select("day_number", { count: "exact", head: true })
    .eq("day_number", dayNumber);

  if (error) {
    throw new AppError("Failed to verify curriculum day.", {
      code: "DATABASE_ERROR",
    });
  }

  if (count === 0) {
    throw new AppError(
      `Curriculum day ${dayNumber} does not exist. Must be between 1 and 105.`,
      { code: "CURRICULUM_DAY_NOT_FOUND" },
    );
  }
}

// ─── Service Functions ───────────────────────────────────────────────────────

/**
 * Gets the current user's journal entry for a specific day.
 * Returns null if not authenticated or no entry exists.
 */
export async function getJournalEntry(
  dayNumber: number,
): Promise<JournalEntry | null> {
  const supabase = await createClient();

  let userId: string;
  try {
    const user = await requireAuth(supabase);
    userId = user.id;
  } catch {
    return null;
  }

  const { data } = await supabase
    .from("daily_learning_entries")
    .select("*")
    .eq("profile_id", userId)
    .eq("day_number", dayNumber)
    .single();

  return (data as JournalEntry) ?? null;
}

/**
 * Gets the current user's journal entry for a specific day,
 * with the related curriculum day data joined.
 */
export async function getJournalEntryWithCurriculum(
  dayNumber: number,
): Promise<JournalEntryWithCurriculum | null> {
  const supabase = await createClient();

  let userId: string;
  try {
    const user = await requireAuth(supabase);
    userId = user.id;
  } catch {
    return null;
  }

  const { data } = await supabase
    .from("daily_learning_entries")
    .select("*, curriculum_days(topic, module_id, week_number)")
    .eq("profile_id", userId)
    .eq("day_number", dayNumber)
    .single();

  return (data as JournalEntryWithCurriculum) ?? null;
}

/**
 * Creates a new journal entry for a specific curriculum day.
 *
 * Validates:
 * - User is authenticated
 * - day_number is valid (1–105)
 * - Curriculum day exists in the database
 * - No duplicate entry for this user+day
 *
 * The entry starts in "draft" status.
 */
export async function createJournalEntry(
  input: CreateJournalEntryInput,
): Promise<JournalEntry> {
  const supabase = await createClient();
  const user = await requireAuth(supabase);

  const dayNumber = validateDayNumber(input.day_number);

  // Verify curriculum day exists
  await requireCurriculumDay(supabase, dayNumber);

  const { data, error } = await supabase
    .from("daily_learning_entries")
    .insert({
      profile_id: user.id,
      day_number: dayNumber,
      status: "draft",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new AppError(
        `A journal entry already exists for Day ${dayNumber}.`,
        { code: "DUPLICATE_JOURNAL" },
      );
    }
    throw new AppError("Failed to create journal entry.", {
      code: "DATABASE_ERROR",
      cause: error,
    });
  }

  return data as JournalEntry;
}

/**
 * Updates an existing journal entry.
 *
 * Validates:
 * - User is authenticated
 * - Entry exists and belongs to the user
 * - Input fields are valid (text lengths, confidence range)
 * - Status is not being set to "used" directly
 * - profile_id and day_number cannot be changed
 *
 * Only provided fields are updated.
 */
export async function updateJournalEntry(
  entryId: string,
  input: UpdateJournalEntryInput,
): Promise<JournalEntry> {
  const supabase = await createClient();
  const user = await requireAuth(supabase);

  // Load and verify ownership
  const existing = await loadOwnEntry(supabase, user.id, entryId);

  // Protect status: prevent client from setting "used"
  if (input.status !== undefined) {
    if (input.status === "used") {
      throw new AppError(
        "Status cannot be set to 'used' directly. This is reserved for the AI content generation pipeline.",
        { code: "INVALID_STATUS" },
      );
    }
    validateStatusTransition(existing.status, input.status);
  }

  // Validate and sanitize input fields (exclude status, which is handled above)
  const fieldsToUpdate = { ...input };
  delete fieldsToUpdate.status;
  const validated = validateJournalInput(fieldsToUpdate);

  const { data, error } = await supabase
    .from("daily_learning_entries")
    .update(validated)
    .eq("id", entryId)
    .eq("profile_id", user.id)
    .select()
    .single();

  if (error) {
    throw new AppError("Failed to update journal entry.", {
      code: "DATABASE_ERROR",
      cause: error,
    });
  }

  return data as JournalEntry;
}

/**
 * Submits a journal entry (sets status from "draft" to "submitted").
 *
 * Validates:
 * - User is authenticated
 * - Entry exists and belongs to the user
 * - Entry contains at least one meaningful learning field
 * - Current status allows submission (must be draft)
 */
export async function submitJournalEntry(
  entryId: string,
): Promise<JournalEntry> {
  const supabase = await createClient();
  const user = await requireAuth(supabase);

  const existing = await loadOwnEntry(supabase, user.id, entryId);

  // Must be in draft status to submit
  validateStatusTransition(existing.status, "submitted");

  // Must have meaningful content
  validateSubmission(existing);

  const { data, error } = await supabase
    .from("daily_learning_entries")
    .update({ status: "submitted" })
    .eq("id", entryId)
    .eq("profile_id", user.id)
    .select()
    .single();

  if (error) {
    throw new AppError("Failed to submit journal entry.", {
      code: "DATABASE_ERROR",
      cause: error,
    });
  }

  return data as JournalEntry;
}

/**
 * Gets the current user's journal history, ordered by day number ascending.
 * Supports optional status filtering.
 */
export async function getJournalHistory(
  status?: JournalEntryStatus,
): Promise<JournalEntry[]> {
  const supabase = await createClient();

  let userId: string;
  try {
    const user = await requireAuth(supabase);
    userId = user.id;
  } catch {
    return [];
  }

  let query = supabase
    .from("daily_learning_entries")
    .select("*")
    .eq("profile_id", userId)
    .order("day_number", { ascending: true });

  if (status) {
    query = query.eq("status", status);
  }

  const { data } = await query;

  return (data as JournalEntry[]) ?? [];
}

/**
 * Gets the current user's journal history with curriculum data joined.
 * Ordered by day number ascending.
 */
export async function getJournalHistoryWithCurriculum(
  status?: JournalEntryStatus,
): Promise<JournalEntryWithCurriculum[]> {
  const supabase = await createClient();

  let userId: string;
  try {
    const user = await requireAuth(supabase);
    userId = user.id;
  } catch {
    return [];
  }

  let query = supabase
    .from("daily_learning_entries")
    .select("*, curriculum_days(topic, module_id, week_number)")
    .eq("profile_id", userId)
    .order("day_number", { ascending: true });

  if (status) {
    query = query.eq("status", status);
  }

  const { data } = await query;

  return (data as JournalEntryWithCurriculum[]) ?? [];
}

/**
 * Deletes a journal entry.
 *
 * Validates:
 * - User is authenticated
 * - Entry exists and belongs to the user
 */
export async function deleteJournalEntry(entryId: string): Promise<void> {
  const supabase = await createClient();
  const user = await requireAuth(supabase);

  // Verify ownership (throws if not found)
  await loadOwnEntry(supabase, user.id, entryId);

  const { error } = await supabase
    .from("daily_learning_entries")
    .delete()
    .eq("id", entryId)
    .eq("profile_id", user.id);

  if (error) {
    throw new AppError("Failed to delete journal entry.", {
      code: "DATABASE_ERROR",
      cause: error,
    });
  }
}
