import { describe, expect, it } from "vitest";
import type { JournalContext } from "@/types/ai";
import type { JournalFieldSource } from "@/types/course-material";
import type {
  ContentOpportunitySourceKind,
  PostType,
} from "@/types/content-opportunity";
import type {
  ContentOpportunityDraft,
  OpportunityBuilderInput,
} from "./opportunities";
import {
  buildContentOpportunities,
  draftToOpportunityInput,
  scoreDrafts,
} from "./opportunities";
import { computeRecruiterScore } from "./scoring";

const PERSONAL_POST_TYPES: readonly PostType[] = [
  "PROJECT_SHOWCASE",
  "PROBLEM_SOLUTION",
  "DEBUGGING_STORY",
  "SECURITY_LESSON",
  "DEPLOYMENT_STORY",
  "API_INTEGRATION",
  "DATABASE_ENGINEERING",
  "AI_ENGINEERING",
  "ENGINEERING_DECISION",
];

function emptyJournal(): JournalContext {
  return {
    whatILearned: null,
    whatIPracticed: null,
    whatIBuilt: null,
    challenge: null,
    howISolvedIt: null,
    keyTakeaway: null,
    tomorrowFocus: null,
    projectName: null,
    projectDescription: null,
    codeReference: null,
    resourcesUsed: null,
    confidenceLevel: null,
    additionalNotes: null,
  };
}

function makeBuilderInput(
  overrides?: Partial<OpportunityBuilderInput>,
): OpportunityBuilderInput {
  return {
    profileId: "user-1",
    sourceType: "journal" satisfies ContentOpportunitySourceKind,
    sourceId: "entry-1",
    dayNumber: 12,
    moduleNumber: null,
    topic: "",
    moduleTitle: null,
    journal: emptyJournal(),
    confirmed: true,
    evidence: [],
    curriculum: null,
    recentPostTypes: [],
    recentTopics: [],
    ...overrides,
  };
}

const CONFIRMED_BUILD_JOURNAL: JournalContext = {
  whatILearned: "State machines keep extraction order stable across documents.",
  whatIPracticed: "Wired an extraction state machine into the parser.",
  whatIBuilt: "Built a small CLI that turns course PDFs into markdown lessons.",
  challenge: "A permission error kept crashing the parser on startup.",
  howISolvedIt: "I fixed it by caching the server session across requests.",
  keyTakeaway: "Sequential processing keeps fragile file parsers alive.",
  tomorrowFocus: null,
  projectName: "Course PDF CLI",
  projectDescription: "A small CLI that rows course PDFs into plain markdown lessons.",
  codeReference: null,
  resourcesUsed: null,
  confidenceLevel: 4,
  additionalNotes: null,
};

function confirmedBuildInput(): OpportunityBuilderInput {
  return makeBuilderInput({ journal: CONFIRMED_BUILD_JOURNAL });
}

describe("Phase 5B — evidence → content opportunities (builder)", () => {
  it("builds a confirmed project, debugging story and learning drafts", () => {
    const drafts = buildContentOpportunities(confirmedBuildInput());

    const types = drafts.map((draft) => draft.postType).sort();
    // Debugging story wins over SECURITY_LESSON because both raise from the
    // same challenge/howISolvedIt evidence (dedup keeps the earliest priority).
    expect(types).toEqual([
      "DEBUGGING_STORY",
      "LEARNING_MILESTONE",
      "PROJECT_SHOWCASE",
      "TECHNICAL_LESSON",
    ]);

    const project = drafts.find((d) => d.postType === "PROJECT_SHOWCASE")!;
    expect(project.evidenceStrength).toBe("USER_CONFIRMED");
    expect(project.evidenceReferences.every((ref) => ref.confidence === "USER_CONFIRMED")).toBe(true);
    expect(project.title).toBe("Building Course PDF CLI");
  });

  it("only claims what the user confirmed — no personal types from a course proposal", () => {
    const evidence: readonly JournalFieldSource[] = [
      { field: "whatILearned", sourceType: "pdf", pageNumbers: [4], confidence: "SUPPORTED_BY_PDF" },
      { field: "whatIBuilt", sourceType: "pdf", pageNumbers: [5], confidence: "SUPPORTED_BY_PDF" },
    ];
    const proposalJournal: JournalContext = {
      ...emptyJournal(),
      whatILearned: "Students learn to secure tenant data with row level security policies.",
      whatIBuilt: "Students will build a todos API with Supabase.",
      keyTakeaway: null,
    };

    const drafts = buildContentOpportunities(
      makeBuilderInput({
        sourceType: "course-material" satisfies ContentOpportunitySourceKind,
        sourceId: "document-1",
        confirmed: false,
        evidence,
        topic: "Supabase Row Level Security",
        moduleTitle: "Module 2: Database Security",
        journal: proposalJournal,
      }),
    );

    for (const type of PERSONAL_POST_TYPES) {
      expect(drafts.find((d) => d.postType === type)).toBeUndefined();
    }

    // The personal-sounding "Students will build…" text supports the learning
    // opportunity only — it never becomes "I built a todos API."
    expect(drafts).toHaveLength(1);
    const lesson = drafts[0]!;
    expect(lesson.postType).toBe("TECHNICAL_LESSON");
    expect(lesson.title).toBe("Understanding Supabase Row Level Security");
    expect(lesson.evidenceStrength).toBe("SUPPORTED_BY_PDF");
    expect(lesson.evidenceReferences[0]!.pageNumbers).toEqual([4]);
  });

  it("never turns unconfirmed drafts into personal claims", () => {
    const drafts = buildContentOpportunities(
      makeBuilderInput({
        confirmed: false,
        journal: {
          ...emptyJournal(),
          whatIBuilt: "Restructured the course PDF parser for multi-day documents.",
          whatILearned: "State machines keep extraction order stable.",
          challenge: "Multi-day files failed to split on the day headers.",
          howISolvedIt: "Replaced naive slicing with a day-detection pass.",
        },
      }),
    );

    for (const type of PERSONAL_POST_TYPES) {
      expect(drafts.find((d) => d.postType === type)).toBeUndefined();
    }

    // Unconfirmed text has no page references → INFERRED; learning content is
    // still allowed, but never a "milestone" (which needs real backing).
    expect(drafts).toHaveLength(1);
    const lesson = drafts[0]!;
    expect(lesson.postType).toBe("TECHNICAL_LESSON");
    expect(lesson.evidenceStrength).toBe("INFERRED_FROM_STRUCTURE");
  });

  it("generates the exact same drafts for the same evidence (deterministic, deduplicated)", () => {
    const first = buildContentOpportunities(confirmedBuildInput());
    const second = buildContentOpportunities(confirmedBuildInput());

    expect(first).toEqual(second);
    const keys = first.map((draft) => draft.dedupKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("does not fabricate anything from an empty journal", () => {
    const drafts = buildContentOpportunities(
      makeBuilderInput({
        journal: {
          ...emptyJournal(),
          tomorrowFocus: null,
          keyTakeaway: null,
          whatILearned: null,
        },
      }),
    );

    expect(drafts).toHaveLength(0);
  });
});

describe("Phase 5B — scoring integration reuses Phase 5A", () => {
  it("scores every draft between 0 and 100 without any LLM", () => {
    const drafts = buildContentOpportunities(confirmedBuildInput());
    const scored = scoreDrafts(drafts, confirmedBuildInput());

    expect(scored).toHaveLength(drafts.length);
    for (const entry of scored) {
      expect(entry.score.total).toBeGreaterThanOrEqual(0);
      expect(entry.score.total).toBeLessThanOrEqual(100);
      expect(typeof entry.score.dimensions.multipleSkills).toBe("number");
    }
  });

  it("ranks confirmed evidence above the same story when unconfirmed", () => {
    const journal = {
      ...emptyJournal(),
      whatILearned: "Row Level Security restricts rows by the authenticated profile id.",
      keyTakeaway: "Policy testing with the local role catches authorization regressions.",
    };

    const confirmedInput = makeBuilderInput({ journal });
    const unconfirmedInput = makeBuilderInput({ journal, confirmed: false });

    const confirmedLesson = scoreDrafts(
      buildContentOpportunities(confirmedInput),
      confirmedInput,
    ).find((s) => s.postType === "TECHNICAL_LESSON")!;
    const unconfirmedLesson = scoreDrafts(
      buildContentOpportunities(unconfirmedInput),
      unconfirmedInput,
    ).find((s) => s.postType === "TECHNICAL_LESSON")!;

    expect(confirmedLesson.score.total).toBeGreaterThan(unconfirmedLesson.score.total);
    expect(confirmedLesson.evidenceStrength).toBe("USER_CONFIRMED");
    expect(unconfirmedLesson.evidenceStrength).toBe("INFERRED_FROM_STRUCTURE");
  });

  it("matches the Phase 5A scorer directly (exact reuse, not a re-implementation)", () => {
    const input = confirmedBuildInput();
    const drafts = buildContentOpportunities(input);
    const project = drafts.find((d) => d.postType === "PROJECT_SHOWCASE")!;

    const viaPipeline = scoreDrafts(drafts, input).find((s) => s.postType === "PROJECT_SHOWCASE")!.score;
    const direct = computeRecruiterScore(draftToOpportunityInput(project, input));

    expect(viaPipeline).toEqual(direct);
  });

  it("passes recent-post history into uniqueness (diversity-aware)", () => {
    const input = confirmedBuildInput();
    const drafts = buildContentOpportunities(input);

    const fresh = scoreDrafts(drafts, { ...input, recentPostTypes: [] });
    const repeated = scoreDrafts(drafts, {
      ...input,
      recentPostTypes: ["PROJECT_SHOWCASE"],
    });

    const freshProject = fresh.find((s) => s.postType === "PROJECT_SHOWCASE")!;
    const repeatedProject = repeated.find((s) => s.postType === "PROJECT_SHOWCASE")!;

    expect(freshProject.score.total).toBeGreaterThan(repeatedProject.score.total);
    expect(freshProject.score.dimensions.uniqueness).toBeGreaterThan(
      repeatedProject.score.dimensions.uniqueness,
    );
  });

  it("keeps scoring deterministic for identical drafts", () => {
    const input = confirmedBuildInput();
    const drafts = buildContentOpportunities(input);

    expect(scoreDrafts(drafts, input)).toEqual(scoreDrafts(drafts, input));
  });

  it("always includes a stable dedup key and category-safe topic", () => {
    const draft: ContentOpportunityDraft = buildContentOpportunities(confirmedBuildInput())[0]!;
    expect(draft.dedupKey).toMatch(/^[a-f0-9]{24}$/);
    expect(draft.topic.length).toBeGreaterThan(0);
  });
});