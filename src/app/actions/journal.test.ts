import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// Mock the journal service module
vi.mock("@/services/journal", () => ({
  getJournalEntry: vi.fn(),
  createJournalEntry: vi.fn(),
  updateJournalEntry: vi.fn(),
  submitJournalEntry: vi.fn(),
  deleteJournalEntry: vi.fn(),
}));

import {
  saveJournal,
  submitJournal,
  fetchJournalEntry,
} from "@/app/actions/journal";
import {
  getJournalEntry,
  createJournalEntry,
  updateJournalEntry,
  submitJournalEntry,
} from "@/services/journal";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveJournal server action", () => {
  it("creates a new entry and updates it when no entryId provided", async () => {
    (createJournalEntry as Mock).mockResolvedValue({
      id: "new-entry-id",
      day_number: 18,
      status: "draft",
    });
    (updateJournalEntry as Mock).mockResolvedValue({
      id: "new-entry-id",
      day_number: 18,
      status: "draft",
      what_i_learned: "React hooks",
    });

    const result = await saveJournal({
      dayNumber: 18,
      whatILearned: "React hooks",
    });

    expect(result.success).toBe(true);
    expect(result.entryId).toBe("new-entry-id");
    expect(result.status).toBe("draft");
    expect(createJournalEntry).toHaveBeenCalledWith({ day_number: 18 });
    expect(updateJournalEntry).toHaveBeenCalledWith("new-entry-id", {
      what_i_learned: "React hooks",
    });
  });

  it("updates existing entry when entryId is provided", async () => {
    (updateJournalEntry as Mock).mockResolvedValue({
      id: "existing-id",
      status: "draft",
    });

    const result = await saveJournal({
      entryId: "existing-id",
      dayNumber: 18,
      whatIBuilt: "A todo app",
    });

    expect(result.success).toBe(true);
    expect(createJournalEntry).not.toHaveBeenCalled();
    expect(updateJournalEntry).toHaveBeenCalledWith("existing-id", {
      what_i_built: "A todo app",
    });
  });

  it("returns error on failure", async () => {
    (createJournalEntry as Mock).mockRejectedValue(
      new Error("Day number must be between 1 and 105."),
    );

    const result = await saveJournal({ dayNumber: 999 });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Day number must be between 1 and 105");
  });
});

describe("submitJournal server action", () => {
  it("submits an existing entry", async () => {
    (submitJournalEntry as Mock).mockResolvedValue({
      id: "entry-id",
      status: "submitted",
    });

    const result = await submitJournal({ entryId: "entry-id" });

    expect(result.success).toBe(true);
    expect(result.status).toBe("submitted");
  });

  it("returns error when submission fails", async () => {
    (submitJournalEntry as Mock).mockRejectedValue(
      new Error("Journal entry must contain at least one"),
    );

    const result = await submitJournal({ entryId: "empty-entry" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("at least one");
  });
});

describe("fetchJournalEntry", () => {
  it("returns entry data when found", async () => {
    (getJournalEntry as Mock).mockResolvedValue({
      id: "entry-id",
      status: "draft",
    });

    const result = await fetchJournalEntry(18);

    expect(result.entryId).toBe("entry-id");
    expect(result.status).toBe("draft");
  });

  it("returns null values when not found", async () => {
    (getJournalEntry as Mock).mockResolvedValue(null);

    const result = await fetchJournalEntry(99);

    expect(result.entryId).toBeNull();
    expect(result.status).toBeNull();
  });

  it("returns null values on error", async () => {
    (getJournalEntry as Mock).mockRejectedValue(new Error("DB error"));

    const result = await fetchJournalEntry(1);

    expect(result.entryId).toBeNull();
    expect(result.status).toBeNull();
  });
});
