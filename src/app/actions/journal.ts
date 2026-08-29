"use server";

import {
  getJournalEntry,
  createJournalEntry,
  updateJournalEntry,
  submitJournalEntry,
  deleteJournalEntry,
} from "@/services/journal";
import type { JournalEntryStatus } from "@/types/journal";
import { generateContentOpportunitiesForDayAction } from "./content-opportunities";

export type OpportunityGenerationOutcome =
  | { status: "created"; count: number }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

export type JournalActionResult = {
  success: boolean;
  error?: string;
  entryId?: string;
  status?: JournalEntryStatus;
  opportunities?: OpportunityGenerationOutcome;
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
/**
 * Best-effort conversion of a just-submitted journal day into recruiter-focused
 * content opportunities. Runs after the journal is confirmed as submitted so a
 * failure here never blocks or rolls back a successful journal submission.
 */
async function buildOpportunitiesAfterSubmit(
  dayNumber: number,
): Promise<OpportunityGenerationOutcome> {
  try {
    const generation = await generateContentOpportunitiesForDayAction({ dayNumber });
    if (generation.success) {
      if (generation.count > 0) {
        return { status: "created", count: generation.count };
      }
      return {
        status: "skipped",
        reason:
          "No recruiter-focused content opportunities could be built from this entry yet.",
      };
    }
    return {
      status: "failed",
      reason: "Your content opportunities could not be built. Try again.",
    };
  } catch {
    return {
      status: "failed",
      reason: "Your content opportunities could not be built. Try again.",
    };
  }
}

export async function submitJournal(
  input: SubmitJournalInput,
): Promise<JournalActionResult> {
  try {
    const submitted = await submitJournalEntry(input.entryId);
    const dayNumber = submitted.day_number;
    const opportunities =
      typeof dayNumber === "number" && Number.isInteger(dayNumber)
        ? await buildOpportunitiesAfterSubmit(dayNumber)
        : undefined;
    return {
      success: true,
      entryId: submitted.id,
      status: submitted.status,
      ...(opportunities ? { opportunities } : {}),
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
