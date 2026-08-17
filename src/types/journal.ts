/**
 * Database row type for daily_learning_entries.
 * Maps directly to the PostgreSQL table columns.
 */
export type JournalEntryStatus = "draft" | "submitted" | "used";

export type JournalEntry = {
  id: string;
  profile_id: string;
  day_number: number;
  status: JournalEntryStatus;

  // Learning fields
  what_i_learned: string | null;
  what_i_practiced: string | null;
  what_i_built: string | null;
  challenge: string | null;
  how_i_solved_it: string | null;
  key_takeaway: string | null;
  tomorrow_focus: string | null;

  // Optional fields
  project_name: string | null;
  project_description: string | null;
  code_reference: string | null;
  resources_used: string | null;
  confidence_level: number | null;
  additional_notes: string | null;

  created_at: string;
  updated_at: string;
};

/**
 * Input type for creating a new journal entry.
 * Only day_number is required — the user fills fields over time.
 */
export type CreateJournalEntryInput = {
  day_number: number;
};

/**
 * Input type for updating a journal entry.
 * All fields are optional — only provided fields are updated.
 */
export type UpdateJournalEntryInput = {
  status?: JournalEntryStatus;
  what_i_learned?: string;
  what_i_practiced?: string;
  what_i_built?: string;
  challenge?: string;
  how_i_solved_it?: string;
  key_takeaway?: string;
  tomorrow_focus?: string;
  project_name?: string;
  project_description?: string;
  code_reference?: string;
  resources_used?: string;
  confidence_level?: number | null;
  additional_notes?: string;
};

/**
 * Journal entry with joined curriculum day data.
 * Used when displaying journal entries alongside curriculum info.
 */
export type JournalEntryWithCurriculum = JournalEntry & {
  curriculum_days: {
    topic: string;
    module_id: string;
    week_number: number | null;
  } | null;
};
