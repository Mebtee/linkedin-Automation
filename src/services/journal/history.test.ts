import { describe, it, expect } from "vitest";

import {
  toHistoryStatus,
  formatHistoryDate,
  truncateText,
  calculateHistorySummary,
} from "@/types/journal-history";
import type { JournalHistoryItem, JournalHistorySummary } from "@/types/journal-history";

// ─── toHistoryStatus ─────────────────────────────────────────────────────────

describe("toHistoryStatus", () => {
  it("maps 'submitted' to 'completed'", () => {
    expect(toHistoryStatus("submitted")).toBe("completed");
  });

  it("maps 'used' to 'completed'", () => {
    expect(toHistoryStatus("used")).toBe("completed");
  });

  it("maps 'draft' to 'draft'", () => {
    expect(toHistoryStatus("draft")).toBe("draft");
  });
});

// ─── formatHistoryDate ───────────────────────────────────────────────────────

describe("formatHistoryDate", () => {
  it("formats ISO date to readable format", () => {
    const result = formatHistoryDate("2026-08-20T14:30:00.000Z");
    expect(result).toMatch(/\w+ \d+, \d{4}/);
  });

  it("handles ISO date strings", () => {
    const result = formatHistoryDate("2026-01-01T00:00:00.000Z");
    expect(result).toContain("2026");
  });
});

// ─── truncateText ────────────────────────────────────────────────────────────

describe("truncateText", () => {
  it("returns full text when shorter than max", () => {
    expect(truncateText("Short", 50)).toBe("Short");
  });

  it("truncates text exceeding max length", () => {
    const result = truncateText("This is a long text that should be truncated", 20);
    expect(result.length).toBeLessThanOrEqual(23);
    expect(result).toContain("...");
    expect(result.length).toBeLessThan("This is a long text that should be truncated".length);
  });

  it("returns empty string for null", () => {
    expect(truncateText(null, 50)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(truncateText("", 50)).toBe("");
  });
});

// ─── calculateHistorySummary ─────────────────────────────────────────────────

describe("calculateHistorySummary", () => {
  const makeItems = (
    completed: number,
    draft: number,
  ): JournalHistoryItem[] => {
    const items: JournalHistoryItem[] = [];
    for (let i = 0; i < completed; i++) {
      items.push({
        day_number: i + 1,
        topic: `Day ${i + 1}`,
        module_number: 1,
        module_title: "Module 1",
        status: "completed",
        what_i_learned: null,
        key_takeaway: null,
        what_i_built: null,
        confidence_level: null,
        updated_at: "2026-01-01",
      });
    }
    for (let i = 0; i < draft; i++) {
      items.push({
        day_number: completed + i + 1,
        topic: `Day ${completed + i + 1}`,
        module_number: 1,
        module_title: "Module 1",
        status: "draft",
        what_i_learned: null,
        key_takeaway: null,
        what_i_built: null,
        confidence_level: null,
        updated_at: "2026-01-01",
      });
    }
    return items;
  };

  it("calculates summary correctly", () => {
    const summary = calculateHistorySummary(makeItems(12, 3));

    expect(summary.total_days).toBe(105);
    expect(summary.completed_days).toBe(12);
    expect(summary.draft_days).toBe(3);
    expect(summary.not_started_days).toBe(90);
    expect(summary.percentage).toBe(11); // 12/105 = 11.43% → 11%
  });

  it("returns zeros for empty history", () => {
    const summary = calculateHistorySummary([]);

    expect(summary.completed_days).toBe(0);
    expect(summary.draft_days).toBe(0);
    expect(summary.not_started_days).toBe(105);
    expect(summary.percentage).toBe(0);
  });

  it("calculates 100% when all days completed", () => {
    const items = makeItems(105, 0);
    const summary = calculateHistorySummary(items);

    expect(summary.completed_days).toBe(105);
    expect(summary.not_started_days).toBe(0);
    expect(summary.percentage).toBe(100);
  });

  it("does not count drafts as completed", () => {
    const summary = calculateHistorySummary(makeItems(0, 10));

    expect(summary.completed_days).toBe(0);
    expect(summary.draft_days).toBe(10);
    expect(summary.percentage).toBe(0);
  });
});

// ─── JournalHistoryItem type tests ───────────────────────────────────────────

describe("JournalHistoryItem", () => {
  it("has required fields", () => {
    const item: JournalHistoryItem = {
      day_number: 1,
      topic: "Introduction to React",
      module_number: 1,
      module_title: "Frontend Foundations",
      status: "completed",
      what_i_learned: "Today I learned about React components.",
      key_takeaway: "Components are reusable UI pieces.",
      what_i_built: "A hello world component.",
      confidence_level: 4,
      updated_at: "2026-08-20T10:00:00Z",
    };

    expect(item.day_number).toBe(1);
    expect(item.status).toBe("completed");
    expect(item.confidence_level).toBe(4);
  });

  it("allows null preview fields", () => {
    const item: JournalHistoryItem = {
      day_number: 5,
      topic: "Day 5",
      module_number: 1,
      module_title: "Module 1",
      status: "draft",
      what_i_learned: null,
      key_takeaway: null,
      what_i_built: null,
      confidence_level: null,
      updated_at: "2026-08-20",
    };

    expect(item.what_i_learned).toBeNull();
    expect(item.key_takeaway).toBeNull();
    expect(item.what_i_built).toBeNull();
    expect(item.confidence_level).toBeNull();
  });
});

// ─── JournalHistorySummary type tests ────────────────────────────────────────

describe("JournalHistorySummary", () => {
  it("has required fields", () => {
    const summary: JournalHistorySummary = {
      total_days: 105,
      completed_days: 12,
      draft_days: 3,
      not_started_days: 90,
      percentage: 11,
    };

    expect(summary.total_days).toBe(105);
    expect(summary.completed_days + summary.draft_days + summary.not_started_days).toBe(105);
  });
});
