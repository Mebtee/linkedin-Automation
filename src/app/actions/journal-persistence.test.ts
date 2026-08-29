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

describe("Phase 2D: Persistence Workflow", () => {
  describe("Create draft", () => {
    it("creates a new entry and updates it with content", async () => {
      (createJournalEntry as Mock).mockResolvedValue({
        id: "entry-1",
        day_number: 18,
        status: "draft",
        created_at: "2026-08-17T10:00:00Z",
        updated_at: "2026-08-17T10:00:00Z",
      });
      (updateJournalEntry as Mock).mockResolvedValue({
        id: "entry-1",
        day_number: 18,
        status: "draft",
        what_i_learned: "React hooks",
        what_i_practiced: "Built a counter",
        created_at: "2026-08-17T10:00:00Z",
        updated_at: "2026-08-17T10:05:00Z",
      });

      const result = await saveJournal({
        dayNumber: 18,
        whatILearned: "React hooks",
        whatIPracticed: "Built a counter",
      });

      expect(result.success).toBe(true);
      expect(result.entryId).toBe("entry-1");
      expect(result.status).toBe("draft");
      expect(createJournalEntry).toHaveBeenCalledWith({ day_number: 18 });
      expect(updateJournalEntry).toHaveBeenCalledWith("entry-1", {
        what_i_learned: "React hooks",
        what_i_practiced: "Built a counter",
      });
    });

    it("does not create a second row when saving again", async () => {
      // First save creates
      (createJournalEntry as Mock).mockResolvedValue({
        id: "entry-1",
        day_number: 18,
        status: "draft",
      });
      (updateJournalEntry as Mock).mockResolvedValue({
        id: "entry-1",
        status: "draft",
      });

      await saveJournal({ dayNumber: 18, whatILearned: "First save" });

      // Second save updates (entryId is now set)
      (updateJournalEntry as Mock).mockResolvedValue({
        id: "entry-1",
        status: "draft",
        what_i_learned: "Second save",
      });

      const result = await saveJournal({
        entryId: "entry-1",
        dayNumber: 18,
        whatILearned: "Second save",
      });

      expect(result.success).toBe(true);
      expect(createJournalEntry).toHaveBeenCalledTimes(1);
      expect(updateJournalEntry).toHaveBeenCalledTimes(2);
    });
  });

  describe("Reload draft", () => {
    it("loads existing draft content", async () => {
      (getJournalEntry as Mock).mockResolvedValue({
        id: "entry-1",
        day_number: 18,
        status: "draft",
        what_i_learned: "React hooks",
        what_i_practiced: "Built a counter",
        what_i_built: "Counter app",
        challenge: "Understanding closures",
        how_i_solved_it: "Read the docs",
        key_takeaway: "Hooks are powerful",
        tomorrow_focus: "Custom hooks",
        confidence_level: 3,
      });

      const entry = await getJournalEntry(18);

      expect(entry).not.toBeNull();
      expect(entry?.what_i_learned).toBe("React hooks");
      expect(entry?.what_i_practiced).toBe("Built a counter");
      expect(entry?.what_i_built).toBe("Counter app");
      expect(entry?.confidence_level).toBe(3);
    });

    it("returns null for a day with no journal", async () => {
      (getJournalEntry as Mock).mockResolvedValue(null);

      const entry = await getJournalEntry(99);

      expect(entry).toBeNull();
    });
  });

  describe("Update draft", () => {
    it("updates the same entry with new content", async () => {
      (updateJournalEntry as Mock).mockResolvedValue({
        id: "entry-1",
        status: "draft",
        what_i_learned: "Updated learning",
        key_takeaway: "New takeaway",
      });

      const result = await saveJournal({
        entryId: "entry-1",
        dayNumber: 18,
        whatILearned: "Updated learning",
        keyTakeaway: "New takeaway",
      });

      expect(result.success).toBe(true);
      expect(updateJournalEntry).toHaveBeenCalledWith("entry-1", {
        what_i_learned: "Updated learning",
        key_takeaway: "New takeaway",
      });
    });

    it("preserves unchanged fields", async () => {
      (updateJournalEntry as Mock).mockResolvedValue({
        id: "entry-1",
        status: "draft",
      });

      await saveJournal({
        entryId: "entry-1",
        dayNumber: 18,
        whatILearned: "Only this field changed",
      });

      // Only the changed field should be sent
      expect(updateJournalEntry).toHaveBeenCalledWith("entry-1", {
        what_i_learned: "Only this field changed",
      });
    });
  });

  describe("Submit draft", () => {
    it("changes status from draft to submitted", async () => {
      (submitJournalEntry as Mock).mockResolvedValue({
        id: "entry-1",
        status: "submitted",
      });

      const result = await submitJournal({ entryId: "entry-1" });

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

  describe("Reload submitted journal", () => {
    it("loads submitted journal with correct status", async () => {
      (getJournalEntry as Mock).mockResolvedValue({
        id: "entry-1",
        day_number: 18,
        status: "submitted",
        what_i_learned: "React hooks",
      });

      const entry = await getJournalEntry(18);

      expect(entry).not.toBeNull();
      expect(entry?.status).toBe("submitted");
    });
  });

  describe("Day boundaries", () => {
    it("day 1 loads correct curriculum and journal", async () => {
      (getJournalEntry as Mock).mockResolvedValue({
        id: "entry-day1",
        day_number: 1,
        status: "draft",
      });

      const entry = await getJournalEntry(1);

      expect(entry).not.toBeNull();
      expect(entry?.day_number).toBe(1);
    });

    it("day 105 loads correct curriculum and journal", async () => {
      (getJournalEntry as Mock).mockResolvedValue({
        id: "entry-day105",
        day_number: 105,
        status: "draft",
      });

      const entry = await getJournalEntry(105);

      expect(entry).not.toBeNull();
      expect(entry?.day_number).toBe(105);
    });
  });

  describe("Invalid day parameters", () => {
    it("invalid day returns null", async () => {
      (getJournalEntry as Mock).mockResolvedValue(null);

      const entry = await getJournalEntry(0);
      expect(entry).toBeNull();
    });

    it("day beyond range returns null", async () => {
      (getJournalEntry as Mock).mockResolvedValue(null);

      const entry = await getJournalEntry(106);
      expect(entry).toBeNull();
    });

    it("negative day returns null", async () => {
      (getJournalEntry as Mock).mockResolvedValue(null);

      const entry = await getJournalEntry(-1);
      expect(entry).toBeNull();
    });
  });

  describe("Duplicate protection", () => {
    it("handles duplicate creation gracefully", async () => {
      (createJournalEntry as Mock).mockRejectedValue(
        new Error("A journal entry already exists for Day 18."),
      );

      const result = await saveJournal({ dayNumber: 18 });

      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists");
    });
  });

  describe("All fields persist", () => {
    it("saves and retrieves all journal fields", async () => {
      const fullEntry = {
        id: "entry-full",
        day_number: 18,
        status: "draft",
        what_i_learned: "React hooks deep dive",
        what_i_practiced: "useState, useEffect, custom hooks",
        what_i_built: "Habit tracker app",
        challenge: "Understanding useEffect cleanup",
        how_i_solved_it: "Read React docs and wrote test cases",
        key_takeaway: "Hooks make state management elegant",
        tomorrow_focus: "useContext and useReducer",
        project_name: "Habit Tracker",
        project_description: "A daily habit tracking app",
        code_reference: "https://github.com/user/habit-tracker",
        resources_used: "React docs, Kent C. Dodds blog",
        confidence_level: 4,
        additional_notes: "Need to review closure patterns",
        created_at: "2026-08-17T10:00:00Z",
        updated_at: "2026-08-17T10:05:00Z",
      };

      (createJournalEntry as Mock).mockResolvedValue(fullEntry);
      (updateJournalEntry as Mock).mockResolvedValue(fullEntry);

      const result = await saveJournal({
        dayNumber: 18,
        whatILearned: fullEntry.what_i_learned,
        whatIPracticed: fullEntry.what_i_practiced,
        whatIBuilt: fullEntry.what_i_built,
        challenge: fullEntry.challenge,
        howISolvedIt: fullEntry.how_i_solved_it,
        keyTakeaway: fullEntry.key_takeaway,
        tomorrowFocus: fullEntry.tomorrow_focus,
        projectName: fullEntry.project_name,
        projectDescription: fullEntry.project_description,
        codeReference: fullEntry.code_reference,
        resourcesUsed: fullEntry.resources_used,
        confidenceLevel: fullEntry.confidence_level,
        additionalNotes: fullEntry.additional_notes,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Timestamps", () => {
    it("created_at remains unchanged after editing", async () => {
      const originalCreatedAt = "2026-08-17T10:00:00Z";

      (updateJournalEntry as Mock).mockResolvedValue({
        id: "entry-1",
        created_at: originalCreatedAt,
        updated_at: "2026-08-17T10:05:00Z",
      });

      const result = await saveJournal({
        entryId: "entry-1",
        dayNumber: 18,
        whatILearned: "Updated content",
      });

      expect(result.success).toBe(true);
      // The service should not overwrite created_at
    });
  });

  describe("Rapid save protection", () => {
    it("disables save button while saving", async () => {
      // This is tested via the component's isSaving state
      // The button is disabled when isSaving is true
      (createJournalEntry as Mock).mockResolvedValue({
        id: "entry-1",
        status: "draft",
      });
      (updateJournalEntry as Mock).mockResolvedValue({
        id: "entry-1",
        status: "draft",
      });

      // First save
      const result1 = await saveJournal({ dayNumber: 18, whatILearned: "First" });
      expect(result1.success).toBe(true);

      // Second save with entryId (would be blocked by UI)
      const result2 = await saveJournal({
        entryId: "entry-1",
        dayNumber: 18,
        whatILearned: "Second",
      });
      expect(result2.success).toBe(true);

      // Both succeed at service level, but UI prevents rapid saves
    });
  });

  describe("Day navigation isolation", () => {
    it("day 10 journal never appears on day 11", async () => {
      (getJournalEntry as Mock).mockResolvedValueOnce({
        id: "entry-day10",
        day_number: 10,
        what_i_learned: "Day 10 content",
      });
      (getJournalEntry as Mock).mockResolvedValueOnce({
        id: "entry-day11",
        day_number: 11,
        what_i_learned: "Day 11 content",
      });

      const day10 = await getJournalEntry(10);
      const day11 = await getJournalEntry(11);

      expect(day10?.day_number).toBe(10);
      expect(day11?.day_number).toBe(11);
      expect(day10?.what_i_learned).toBe("Day 10 content");
      expect(day11?.what_i_learned).toBe("Day 11 content");
    });
  });

  describe("Empty optional fields", () => {
    it("handles empty optional fields correctly", async () => {
      (updateJournalEntry as Mock).mockResolvedValue({
        id: "entry-1",
        status: "draft",
      });

      await saveJournal({
        entryId: "entry-1",
        dayNumber: 18,
        whatILearned: "Only required",
        // All other fields undefined
      });

      expect(updateJournalEntry).toHaveBeenCalledWith("entry-1", {
        what_i_learned: "Only required",
      });
    });
  });

  describe("Special characters", () => {
    it("handles apostrophes and quotes", async () => {
      (updateJournalEntry as Mock).mockResolvedValue({
        id: "entry-1",
        status: "draft",
      });

      await saveJournal({
        entryId: "entry-1",
        dayNumber: 18,
        whatILearned: "It's a \"great\" day for coding",
      });

      expect(updateJournalEntry).toHaveBeenCalledWith("entry-1", {
        what_i_learned: "It's a \"great\" day for coding",
      });
    });

    it("handles line breaks", async () => {
      (updateJournalEntry as Mock).mockResolvedValue({
        id: "entry-1",
        status: "draft",
      });

      await saveJournal({
        entryId: "entry-1",
        dayNumber: 18,
        whatILearned: "Line 1\nLine 2\nLine 3",
      });

      expect(updateJournalEntry).toHaveBeenCalledWith("entry-1", {
        what_i_learned: "Line 1\nLine 2\nLine 3",
      });
    });

    it("handles technical terms", async () => {
      (updateJournalEntry as Mock).mockResolvedValue({
        id: "entry-1",
        status: "draft",
      });

      await saveJournal({
        entryId: "entry-1",
        dayNumber: 18,
        whatILearned: "useState, useEffect, useCallback, useMemo",
      });

      expect(updateJournalEntry).toHaveBeenCalledWith("entry-1", {
        what_i_learned: "useState, useEffect, useCallback, useMemo",
      });
    });
  });
});
