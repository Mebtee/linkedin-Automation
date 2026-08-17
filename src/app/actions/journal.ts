"use server";

import {
  getJournalEntry,
  createJournalEntry,
  updateJournalEntry,
  submitJournalEntry,
  deleteJournalEntry,
} from "@/services/journal";
import type { JournalEntryStatus } from "@/types/journal";

export type JournalActionResult = {
  success: boolean;
  error?: string;
  entryId?: string;
  status?: JournalEntryStatus;
};

export type SaveJournalInput = {
  entryId?: string;
  dayNumber: number;
  whatILearned?: string;
  whatIPracticed?: string;
  whatIBuilt?: string;
  challenge?: string;
  howISolvedIt?: string;
  keyTakeaway?: string;
  tomorrowFocus?: string;
  projectName?: string;
  projectDescription?: string;
  codeReference?: string;
  resourcesUsed?: string;
  confidenceLevel?: number | null;
  additionalNotes?: string;
};

export type SubmitJournalInput = {
  entryId: string;
};

/**
 * Creates or updates a journal entry (save as draft).
 */
export async function saveJournal(
  input: SaveJournalInput,
): Promise<JournalActionResult> {
  try {
    let entryId = input.entryId;

    if (!entryId) {
      const created = await createJournalEntry({ day_number: input.dayNumber });
      entryId = created.id;
    }

    const updated = await updateJournalEntry(entryId, {
      what_i_learned: input.whatILearned || undefined,
      what_i_practiced: input.whatIPracticed || undefined,
      what_i_built: input.whatIBuilt || undefined,
      challenge: input.challenge || undefined,
      how_i_solved_it: input.howISolvedIt || undefined,
      key_takeaway: input.keyTakeaway || undefined,
      tomorrow_focus: input.tomorrowFocus || undefined,
      project_name: input.projectName || undefined,
      project_description: input.projectDescription || undefined,
      code_reference: input.codeReference || undefined,
      resources_used: input.resourcesUsed || undefined,
      confidence_level: input.confidenceLevel,
      additional_notes: input.additionalNotes || undefined,
    });

    return {
      success: true,
      entryId: updated.id,
      status: updated.status,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to save journal entry.";
    return { success: false, error: message };
  }
}

/**
 * Submits an existing journal entry.
 */
export async function submitJournal(
  input: SubmitJournalInput,
): Promise<JournalActionResult> {
  try {
    const submitted = await submitJournalEntry(input.entryId);
    return {
      success: true,
      entryId: submitted.id,
      status: submitted.status,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to submit journal entry.";
    return { success: false, error: message };
  }
}

/**
 * Deletes a journal entry.
 */
export async function deleteJournal(
  entryId: string,
): Promise<JournalActionResult> {
  try {
    await deleteJournalEntry(entryId);
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete journal entry.";
    return { success: false, error: message };
  }
}

/**
 * Fetches a journal entry for a specific day (used for navigation refresh).
 */
export async function fetchJournalEntry(
  dayNumber: number,
): Promise<{ entryId: string | null; status: JournalEntryStatus | null }> {
  try {
    const entry = await getJournalEntry(dayNumber);
    return {
      entryId: entry?.id ?? null,
      status: entry?.status ?? null,
    };
  } catch {
    return { entryId: null, status: null };
  }
}
