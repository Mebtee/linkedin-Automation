export type JournalEntry = {
  id: string;
  /** 1-based day number the entry belongs to. */
  day: number;
  /** ISO 8601 timestamp. */
  createdAt: string;
  /** ISO 8601 timestamp. */
  updatedAt: string;
  /** What was learned that day. */
  learned: string;
  challenges?: string;
  notes?: string;
};
