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

// Mock the opportunity generation action wired into submitJournal
vi.mock("@/app/actions/content-opportunities", () => ({
  generateContentOpportunitiesForDayAction: vi.fn(),
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
import { generateContentOpportunitiesForDayAction } from "@/app/actions/content-opportunities";

beforeEach(() => {
  vi.clearAllMocks();
  (generateContentOpportunitiesForDayAction as Mock).mockResolvedValue({
    success: true,
    count: 0,
    opportunities: [],
  });
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

  it("builds content opportunities after a successful submission", async () => {
    (submitJournalEntry as Mock).mockResolvedValue({
      id: "entry-id",
      day_number: 12,
      status: "submitted",
    });
    (generateContentOpportunitiesForDayAction as Mock).mockResolvedValue({
      success: true,
      count: 3,
      opportunities: [{ id: "op-1" }, { id: "op-2" }, { id: "op-3" }],
    });

    const result = await submitJournal({ entryId: "entry-id" });

    expect(result.success).toBe(true);
    expect(result.status).toBe("submitted");
    expect(result.opportunities).toEqual({ status: "created", count: 3 });
    expect(generateContentOpportunitiesForDayAction).toHaveBeenCalledTimes(1);
    expect(generateContentOpportunitiesForDayAction).toHaveBeenCalledWith({
      dayNumber: 12,
    });
  });

  it("does not build opportunities when submission fails", async () => {
    (submitJournalEntry as Mock).mockRejectedValue(
      new Error("Journal entry must contain at least one"),
    );

    const result = await submitJournal({ entryId: "empty-entry" });

    expect(result.success).toBe(false);
    expect(generateContentOpportunitiesForDayAction).not.toHaveBeenCalled();
  });

  it("still reports a successful journal when generation fails gracefully", async () => {
    (submitJournalEntry as Mock).mockResolvedValue({
      id: "entry-id",
      day_number: 12,
      status: "submitted",
    });
    (generateContentOpportunitiesForDayAction as Mock).mockResolvedValue({
      success: false,
      error: "opportunity build failed",
    });

    const result = await submitJournal({ entryId: "entry-id" });

    expect(result.success).toBe(true);
    expect(result.status).toBe("submitted");
    expect(result.error).toBeUndefined();
    expect(result.opportunities?.status).toBe("failed");
  });

  it("does not fail the journal when generation throws", async () => {
    (submitJournalEntry as Mock).mockResolvedValue({
      id: "entry-id",
      day_number: 12,
      status: "submitted",
    });
    (generateContentOpportunitiesForDayAction as Mock).mockRejectedValue(
      new Error("network down"),
    );

    const result = await submitJournal({ entryId: "entry-id" });

    expect(result.success).toBe(true);
    expect(result.opportunities?.status).toBe("failed");
  });

  it("reports a skipped outcome when generation builds nothing", async () => {
    (submitJournalEntry as Mock).mockResolvedValue({
      id: "entry-id",
      day_number: 12,
      status: "submitted",
    });
    (generateContentOpportunitiesForDayAction as Mock).mockResolvedValue({
      success: true,
      count: 0,
      opportunities: [],
    });

    const result = await submitJournal({ entryId: "entry-id" });

    expect(result.success).toBe(true);
    expect(result.opportunities?.status).toBe("skipped");
  });

  it("does not attempt generation without a day number", async () => {
    (submitJournalEntry as Mock).mockResolvedValue({
      id: "entry-id",
      status: "submitted",
    });

    const result = await submitJournal({ entryId: "entry-id" });

    expect(result.success).toBe(true);
    expect(result.opportunities).toBeUndefined();
    expect(generateContentOpportunitiesForDayAction).not.toHaveBeenCalled();
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
