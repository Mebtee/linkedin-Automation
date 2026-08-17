import { describe, it, expect } from "vitest";

import { toDayStatus } from "@/types/curriculum";
import type { JournalEntryStatus } from "@/types/journal";
import {
  buildJournalStatusMap,
  enrichCurriculumDays,
  calculateCurriculumProgress,
  calculateModuleProgress,
  dayStatusLabel,
  journalActionLabel,
} from "./integration";
import type { CurriculumDayRow, ModuleRow } from "./dayProgress";

// ─── toDayStatus ─────────────────────────────────────────────────────────────

describe("toDayStatus", () => {
  it("maps 'submitted' to 'completed'", () => {
    expect(toDayStatus("submitted")).toBe("completed");
  });

  it("maps 'used' to 'completed'", () => {
    expect(toDayStatus("used")).toBe("completed");
  });

  it("maps 'draft' to 'draft'", () => {
    expect(toDayStatus("draft")).toBe("draft");
  });

  it("maps null to 'not_started'", () => {
    expect(toDayStatus(null)).toBe("not_started");
  });

  it("maps undefined to 'not_started'", () => {
    expect(toDayStatus(undefined)).toBe("not_started");
  });
});

// ─── buildJournalStatusMap ───────────────────────────────────────────────────

describe("buildJournalStatusMap", () => {
  it("creates a map from journal entries", () => {
    const entries = [
      { day_number: 1, status: "submitted" as JournalEntryStatus },
      { day_number: 5, status: "draft" as JournalEntryStatus },
      { day_number: 10, status: "submitted" as JournalEntryStatus },
    ];

    const map = buildJournalStatusMap(entries);

    expect(map.get(1)).toBe("submitted");
    expect(map.get(5)).toBe("draft");
    expect(map.get(10)).toBe("submitted");
    expect(map.size).toBe(3);
  });

  it("returns empty map for empty entries", () => {
    const map = buildJournalStatusMap([]);
    expect(map.size).toBe(0);
  });

  it("handles duplicate day numbers (last wins)", () => {
    const entries = [
      { day_number: 1, status: "draft" as JournalEntryStatus },
      { day_number: 1, status: "submitted" as JournalEntryStatus },
    ];

    const map = buildJournalStatusMap(entries);
    expect(map.get(1)).toBe("submitted");
  });
});

// ─── calculateCurriculumProgress ─────────────────────────────────────────────

describe("calculateCurriculumProgress", () => {
  it("calculates progress correctly", () => {
    const progress = calculateCurriculumProgress(12, 15);

    expect(progress.total_days).toBe(105);
    expect(progress.completed_days).toBe(12);
    expect(progress.percentage).toBe(11); // 12/105 = 11.43% → 11%
    expect(progress.currentDay).toBe(15);
  });

  it("returns 0% when no days completed", () => {
    const progress = calculateCurriculumProgress(0, 10);

    expect(progress.completed_days).toBe(0);
    expect(progress.percentage).toBe(0);
  });

  it("returns 100% when all days completed", () => {
    const progress = calculateCurriculumProgress(105, 105);

    expect(progress.completed_days).toBe(105);
    expect(progress.percentage).toBe(100);
  });

  it("calculates current module from current day", () => {
    const progress = calculateCurriculumProgress(5, 15);
    expect(progress.currentModule).toBe(3); // day 15 → week 3 → module 3
  });
});

// ─── calculateModuleProgress ─────────────────────────────────────────────────

describe("calculateModuleProgress", () => {
  const testModule: ModuleRow = {
    id: "mod-1",
    module_number: 1,
    title: "Module 1",
    description: null,
    weeks: 1,
    days: 10,
    hours: 30,
    start_day: 1,
    end_day: 10,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  };

  it("calculates module progress correctly", () => {
    const journalMap = new Map<number, JournalEntryStatus>([
      [1, "submitted"],
      [2, "submitted"],
      [3, "draft"],
    ]);

    const progress = calculateModuleProgress(testModule, journalMap, 5);

    expect(progress.completed_days).toBe(2);
    expect(progress.total_days).toBe(10);
    expect(progress.is_complete).toBe(false);
    expect(progress.is_current).toBe(true); // day 5 is in range 1-10
  });

  it("marks module complete when all days submitted", () => {
    const journalMap = new Map<number, JournalEntryStatus>([
      [1, "submitted"],
      [2, "submitted"],
      [3, "submitted"],
      [4, "submitted"],
      [5, "submitted"],
      [6, "submitted"],
      [7, "submitted"],
      [8, "submitted"],
      [9, "submitted"],
      [10, "submitted"],
    ]);

    const progress = calculateModuleProgress(testModule, journalMap, 5);

    expect(progress.is_complete).toBe(true);
    expect(progress.completed_days).toBe(10);
  });

  it("does not count drafts as completed", () => {
    const journalMap = new Map<number, JournalEntryStatus>([
      [1, "draft"],
      [2, "draft"],
      [3, "draft"],
    ]);

    const progress = calculateModuleProgress(testModule, journalMap, 5);

    expect(progress.completed_days).toBe(0);
    expect(progress.is_complete).toBe(false);
  });

  it("marks is_current correctly", () => {
    const progress1 = calculateModuleProgress(testModule, new Map(), 5);
    expect(progress1.is_current).toBe(true);

    const progress2 = calculateModuleProgress(testModule, new Map(), 15);
    expect(progress2.is_current).toBe(false);
  });
});

// ─── dayStatusLabel ──────────────────────────────────────────────────────────

describe("dayStatusLabel", () => {
  it("returns correct labels", () => {
    expect(dayStatusLabel("completed")).toBe("Completed");
    expect(dayStatusLabel("draft")).toBe("Draft");
    expect(dayStatusLabel("not_started")).toBe("Not started");
  });
});

// ─── journalActionLabel ──────────────────────────────────────────────────────

describe("journalActionLabel", () => {
  it("returns correct action labels", () => {
    expect(journalActionLabel("completed")).toBe("View Journal");
    expect(journalActionLabel("draft")).toBe("Continue Journal");
    expect(journalActionLabel("not_started")).toBe("Start Journal");
  });
});

// ─── enrichCurriculumDays ────────────────────────────────────────────────────

describe("enrichCurriculumDays", () => {
  const testDays: CurriculumDayRow[] = [
    {
      id: "1",
      day_number: 1,
      module_id: "mod-1",
      week_number: 1,
      topic: "Day 1 Topic",
      content: "Content 1",
      subtopics: ["sub1"],
      project_information: null,
      assessment_information: null,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    },
    {
      id: "2",
      day_number: 2,
      module_id: "mod-1",
      week_number: 1,
      topic: "Day 2 Topic",
      content: "Content 2",
      subtopics: null,
      project_information: null,
      assessment_information: null,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    },
  ];

  const testModules: ModuleRow[] = [
    {
      id: "mod-1",
      module_number: 1,
      title: "Module 1",
      description: null,
      weeks: 1,
      days: 2,
      hours: 6,
      start_day: 1,
      end_day: 2,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    },
  ];

  it("enriches days with journal status", () => {
    const journalMap = new Map<number, JournalEntryStatus>([[1, "submitted"]]);

    const enriched = enrichCurriculumDays(testDays, testModules, journalMap, 1);

    expect(enriched[0]?.dayStatus).toBe("completed");
    expect(enriched[1]?.dayStatus).toBe("not_started");
  });

  it("marks current day correctly", () => {
    const journalMap = new Map<number, JournalEntryStatus>();

    const enriched = enrichCurriculumDays(testDays, testModules, journalMap, 2);

    expect(enriched[0]?.isToday).toBe(false);
    expect(enriched[1]?.isToday).toBe(true);
  });

  it("includes module info", () => {
    const journalMap = new Map<number, JournalEntryStatus>();

    const enriched = enrichCurriculumDays(testDays, testModules, journalMap, 1);

    expect(enriched[0]?.module_number).toBe(1);
    expect(enriched[0]?.module_title).toBe("Module 1");
  });
});
