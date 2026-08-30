import { describe, it, expect } from "vitest";
import { buildPostGenerationInput } from "./input-builder";
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
