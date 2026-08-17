import { describe, it, expect } from "vitest";
import { buildPostGenerationInput, selectDefaultFormat } from "./input-builder";
import type { JournalEntry } from "@/types/journal";
import type { CurriculumDayForInput, ModuleForInput } from "./input-builder";

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const curriculumDay: CurriculumDayForInput = {
  day_number: 1,
  topic: "Git and Terminal Basics",
  content: "Learn to use Git for version control and the terminal for navigation.",
  subtopics: ["git init", "git add", "git commit", "terminal commands"],
  project_information: null,
  assessment_information: null,
};

const moduleData: ModuleForInput = {
  module_number: 1,
  title: "Foundation: Git, Terminal, Python, OOP & DSA",
};

const journal: JournalEntry = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  profile_id: "user-123",
  day_number: 1,
  status: "submitted",
  what_i_learned: "I learned how to use git init, git add, and git commit.",
  what_i_practiced: "I practiced creating a repository and making my first commit.",
  what_i_built: null,
  challenge: "I kept forgetting the difference between git add and git commit.",
  how_i_solved_it: "I made a simple rule: git add stages, git commit saves.",
  key_takeaway: "Git is like a save button that remembers every version.",
  tomorrow_focus: "Learn about git branches and merging.",
  project_name: null,
  project_description: null,
  code_reference: null,
  resources_used: "FreeCodeCamp Git tutorial",
  confidence_level: 3,
  additional_notes: null,
  created_at: "2026-08-17T10:00:00Z",
  updated_at: "2026-08-17T10:00:00Z",
};

// ─── selectDefaultFormat ────────────────────────────────────────────────────

describe("selectDefaultFormat", () => {
  it("returns what-i-learned for day 1", () => {
    expect(selectDefaultFormat(1)).toBe("what-i-learned");
  });

  it("returns challenge for day 2", () => {
    expect(selectDefaultFormat(2)).toBe("challenge");
  });

  it("returns small-win for day 3", () => {
    expect(selectDefaultFormat(3)).toBe("small-win");
  });

  it("returns project for day 4", () => {
    expect(selectDefaultFormat(4)).toBe("project");
  });

  it("returns concept for day 5", () => {
    expect(selectDefaultFormat(5)).toBe("concept");
  });

  it("returns reflection for day 6", () => {
    expect(selectDefaultFormat(6)).toBe("reflection");
  });

  it("returns practical-lesson for day 7", () => {
    expect(selectDefaultFormat(7)).toBe("practical-lesson");
  });

  it("wraps around to what-i-learned for day 8", () => {
    expect(selectDefaultFormat(8)).toBe("what-i-learned");
  });

  it("wraps around correctly for day 15", () => {
    // (15 - 1) % 7 = 0 → what-i-learned
    expect(selectDefaultFormat(15)).toBe("what-i-learned");
  });

  it("returns correct format for day 105", () => {
    // (105 - 1) % 7 = 104 % 7 = 6 → practical-lesson
    expect(selectDefaultFormat(105)).toBe("practical-lesson");
  });

  it("is deterministic — same day always returns same format", () => {
    for (let day = 1; day <= 21; day++) {
      const format1 = selectDefaultFormat(day);
      const format2 = selectDefaultFormat(day);
      expect(format1).toBe(format2);
    }
  });

  it("cycles through all 7 formats", () => {
    const formats = new Set<string>();
    for (let day = 1; day <= 7; day++) {
      formats.add(selectDefaultFormat(day));
    }
    expect(formats.size).toBe(7);
  });
});

// ─── buildPostGenerationInput ────────────────────────────────────────────────

describe("buildPostGenerationInput", () => {
  it("maps curriculum day correctly", () => {
    const input = buildPostGenerationInput({
      curriculumDay,
      module: moduleData,
      journal,
      format: "what-i-learned",
    });

    expect(input.curriculum.dayNumber).toBe(1);
    expect(input.curriculum.topic).toBe("Git and Terminal Basics");
    expect(input.curriculum.moduleNumber).toBe(1);
    expect(input.curriculum.moduleTitle).toBe("Foundation: Git, Terminal, Python, OOP & DSA");
    expect(input.curriculum.content).toBe("Learn to use Git for version control and the terminal for navigation.");
    expect(input.curriculum.subtopics).toEqual(["git init", "git add", "git commit", "terminal commands"]);
  });

  it("maps journal fields correctly", () => {
    const input = buildPostGenerationInput({
      curriculumDay,
      module: moduleData,
      journal,
      format: "what-i-learned",
    });

    expect(input.journal.whatILearned).toBe("I learned how to use git init, git add, and git commit.");
    expect(input.journal.whatIPracticed).toBe("I practiced creating a repository and making my first commit.");
    expect(input.journal.keyTakeaway).toBe("Git is like a save button that remembers every version.");
    expect(input.journal.tomorrowFocus).toBe("Learn about git branches and merging.");
    expect(input.journal.confidenceLevel).toBe(3);
  });

  it("preserves null journal fields", () => {
    const input = buildPostGenerationInput({
      curriculumDay,
      module: moduleData,
      journal,
      format: "what-i-learned",
    });

    expect(input.journal.whatIBuilt).toBeNull();
    expect(input.journal.projectName).toBeNull();
    expect(input.journal.projectDescription).toBeNull();
    expect(input.journal.codeReference).toBeNull();
    expect(input.journal.additionalNotes).toBeNull();
  });

  it("includes brand voice from config", () => {
    const input = buildPostGenerationInput({
      curriculumDay,
      module: moduleData,
      journal,
      format: "what-i-learned",
    });

    expect(input.brandVoice).toBeDefined();
    expect(input.brandVoice.tone).toContain("authentic");
    expect(input.brandVoice.avoid).toContain("mastered");
    expect(input.brandVoice.style).toContain("short sentences");
  });

  it("includes content rules from config", () => {
    const input = buildPostGenerationInput({
      curriculumDay,
      module: moduleData,
      journal,
      format: "what-i-learned",
    });

    expect(input.rules).toBeDefined();
    expect(input.rules.targetWordCount.min).toBe(100);
    expect(input.rules.targetWordCount.max).toBe(220);
    expect(input.rules.maxHashtags).toBe(5);
    expect(input.rules.noUnsupportedClaims).toBe(true);
  });

  it("uses the provided format", () => {
    const input = buildPostGenerationInput({
      curriculumDay,
      module: moduleData,
      journal,
      format: "challenge",
    });

    expect(input.format).toBe("challenge");
  });

  it("handles null curriculum content", () => {
    const dayWithNullContent = { ...curriculumDay, content: null };
    const input = buildPostGenerationInput({
      curriculumDay: dayWithNullContent,
      module: moduleData,
      journal,
      format: "what-i-learned",
    });

    expect(input.curriculum.content).toBe("");
  });

  it("handles null curriculum subtopics", () => {
    const dayWithNullSubtopics = { ...curriculumDay, subtopics: null };
    const input = buildPostGenerationInput({
      curriculumDay: dayWithNullSubtopics,
      module: moduleData,
      journal,
      format: "what-i-learned",
    });

    expect(input.curriculum.subtopics).toEqual([]);
  });

  it("preserves curriculum optional fields", () => {
    const dayWithOptionals = {
      ...curriculumDay,
      project_information: "Build a CLI tool",
      assessment_information: "Complete the quiz",
    };
    const input = buildPostGenerationInput({
      curriculumDay: dayWithOptionals,
      module: moduleData,
      journal,
      format: "what-i-learned",
    });

    expect(input.curriculum.projectInformation).toBe("Build a CLI tool");
    expect(input.curriculum.assessmentInformation).toBe("Complete the quiz");
  });

  it("does not invent missing journal information", () => {
    const emptyJournal: JournalEntry = {
      ...journal,
      what_i_learned: null,
      what_i_practiced: null,
      what_i_built: null,
      challenge: null,
      how_i_solved_it: null,
      key_takeaway: null,
      tomorrow_focus: null,
      resources_used: null,
    };

    const input = buildPostGenerationInput({
      curriculumDay,
      module: moduleData,
      journal: emptyJournal,
      format: "what-i-learned",
    });

    expect(input.journal.whatILearned).toBeNull();
    expect(input.journal.whatIPracticed).toBeNull();
    expect(input.journal.whatIBuilt).toBeNull();
    expect(input.journal.challenge).toBeNull();
    expect(input.journal.howISolvedIt).toBeNull();
    expect(input.journal.keyTakeaway).toBeNull();
    expect(input.journal.tomorrowFocus).toBeNull();
    expect(input.journal.resourcesUsed).toBeNull();
  });
});
