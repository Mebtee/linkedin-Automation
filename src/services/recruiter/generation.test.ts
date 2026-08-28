import { describe, it, expect, beforeEach, vi } from "vitest";
import { TemplateFallbackProvider } from "@/services/ai/providers/fallback";
import { AppError } from "@/lib/utils/errors";
import {
  buildRecruiterPostGenerationContext,
  generatePostFromOpportunity,
  selectFormatForPostType,
} from "./generation";
import {
  generatePostFromPreparedInput,
  loadCurriculumDayForRecruiter,
  loadJournalEntryForRecruiter,
  loadModuleForRecruiter,
} from "@/services/ai/generation";
import { findGeneratedPostByOpportunity } from "@/services/generated-posts";
import { updateContentOpportunityStatus } from "./persistence";
import { buildPostGenerationInput } from "@/services/ai/input-builder";
import { createClient } from "@/lib/supabase/server";
import type { PostFormat, JournalContext, PostGenerationInput } from "@/types/ai";
import type {
  ContentOpportunityRow,
  PostType,
} from "@/types/content-opportunity";
import type { GeneratedPostRow } from "@/types/generated-post";
import type { JournalEntry } from "@/types/journal";

// ─── Module Mocks ────────────────────────────────────────────────────────────
// The adapter delegates to the shared core and the generated-posts +
// persistence services. Those are mocked so the adapter's own orchestration,
// gates, and context building are fully isolated for unit testing.

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/services/ai/generation", () => ({
  generatePostFromPreparedInput: vi.fn(),
  loadCurriculumDayForRecruiter: vi.fn(),
  loadModuleForRecruiter: vi.fn(),
  loadJournalEntryForRecruiter: vi.fn(),
}));
vi.mock("@/services/generated-posts", () => ({
  findGeneratedPostByOpportunity: vi.fn(),
}));
vi.mock("./persistence", () => ({
  updateContentOpportunityStatus: vi.fn(),
}));
vi.mock("@/services/ai/input-builder", () => ({
  buildPostGenerationInput: vi.fn(),
}));

const userId = "user-123";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const journalContext: JournalContext = {
  whatILearned: "I learned how git staging works and why commits matter.",
  whatIPracticed: "I practiced committing with clear messages.",
  whatIBuilt: "Built a Git journal tracker that records my daily commits.",
  challenge: "A merge conflict confused me mid-project.",
  howISolvedIt: "I read the docs and resolved the conflict while keeping both changes.",
  keyTakeaway: "Git is a safety net that rewards small, frequent commits.",
  tomorrowFocus: "Learn branches and merging.",
  projectName: "Git Journal Tracker",
  projectDescription: "A small CLI that tracks my learning journal in Git history.",
  codeReference: null,
  resourcesUsed: "FreeCodeCamp Git tutorial",
  confidenceLevel: 3,
  additionalNotes: null,
};

function journalRow(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "journal-1",
    profile_id: userId,
    day_number: 1,
    status: "submitted",
    what_i_learned: journalContext.whatILearned,
    what_i_practiced: journalContext.whatIPracticed,
    what_i_built: journalContext.whatIBuilt,
    challenge: journalContext.challenge,
    how_i_solved_it: journalContext.howISolvedIt,
    key_takeaway: journalContext.keyTakeaway,
    tomorrow_focus: journalContext.tomorrowFocus,
    project_name: journalContext.projectName,
    project_description: journalContext.projectDescription,
    code_reference: journalContext.codeReference,
    resources_used: journalContext.resourcesUsed,
    confidence_level: journalContext.confidenceLevel,
    additional_notes: journalContext.additionalNotes,
    created_at: "2026-08-17T10:00:00Z",
    updated_at: "2026-08-17T10:00:00Z",
    ...overrides,
  };
}

function opportunityRow(
  overrides: Partial<ContentOpportunityRow> = {},
): ContentOpportunityRow {
  return {
    id: "opp-1",
    profile_id: userId,
    source_type: "journal",
    source_id: "src-1",
    day_number: 1,
    module_number: 1,
    post_type: "PROJECT_SHOWCASE",
    content_goal: "SHOW_PROJECTS",
    title: "Building Git Journal Tracker",
    summary: "A small CLI that tracks my learning journal in Git history.",
    evidence: [
      { field: "whatIBuilt", pageNumbers: [3, 4], confidence: "USER_CONFIRMED" },
      { field: "projectName", pageNumbers: [], confidence: "USER_CONFIRMED" },
    ],
    recruiter_score: 88,
    recruiter_score_breakdown: null,
    selection_reason: "Strong implementation evidence, personally confirmed.",
    status: "selected",
    dedup_key: "dk-opp-1",
    created_at: "2026-08-17T10:00:00Z",
    updated_at: "2026-08-17T10:00:00Z",
    ...overrides,
  };
}

const curriculumDay = {
  id: "day-1",
  day_number: 1,
  module_id: "module-1",
  week_number: 1,
  topic: "Git and Terminal Basics",
  content: "Learn to use Git for version control and the terminal for navigation.",
  subtopics: ["git init", "git add", "git commit"],
  project_information: null,
  assessment_information: null,
  created_at: "2026-08-17T00:00:00Z",
  updated_at: "2026-08-17T00:00:00Z",
};

const moduleData = { module_number: 1, title: "Foundation: Git, Terminal, Python, OOP & DSA" };

const savedPost: GeneratedPostRow = {
  id: "post-1",
  profile_id: userId,
  journal_entry_id: "journal-1",
  day_number: 1,
  status: "draft",
  format: "project",
  opening: "Continuing work on Git Journal Tracker.",
  body: "A small CLI that tracks my learning journal in Git history.",
  takeaway: "Git is a safety net that rewards small, frequent commits.",
  next_step: "Learn branches and merging.",
  hashtags: ["#FullStackDevelopment", "#105DaysOfCode", "#NextJS"],
  image_headline: "Building Git Journal Tracker",
  image_subheadline: "A small CLI that tracks my learning journal in Git history.",
  image_keywords: ["git", "nextjs"],
  image_visual_concept: "Project Showcase — Git and Terminal Basics",
  image_template: "project-focused",
  provider: "fallback",
  model: "template-v1",
  tokens_used: null,
  content_hash: "hash-1",
  opportunity_id: "opp-1",
  linkedin_post_id: null,
  published_at: null,
  publish_error: null,
  created_at: "2026-08-17T10:00:00Z",
  updated_at: "2026-08-17T10:00:00Z",
};

// ─── Supabase chain helpers ──────────────────────────────────────────────────

function mockAuth(user: { id: string } | null) {
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(),
  };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return supabase;
}

function mockOwnOpportunity(rows: ContentOpportunityRow[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(
      rows.length === 1
        ? { data: rows[0], error: null }
        : { data: null, error: { message: "not found" } },
    ),
  };
  const supabase = mockAuth({ id: userId });
  supabase.from.mockReturnValue(chain);
  return chain;
}

function stubMocks(options: {
  readonly opportunity?: ContentOpportunityRow;
  readonly existingPost?: GeneratedPostRow | null;
  readonly journal?: JournalEntry;
  readonly coreResult?: GeneratedPostRow;
  readonly coreError?: unknown;
} = {}) {
  mockOwnOpportunity(options.opportunity ? [options.opportunity] : [opportunityRow()]);
  vi.mocked(findGeneratedPostByOpportunity).mockResolvedValue(options.existingPost ?? null);
  vi.mocked(loadCurriculumDayForRecruiter).mockResolvedValue(curriculumDay as never);
  vi.mocked(loadModuleForRecruiter).mockResolvedValue(moduleData as never);
  vi.mocked(loadJournalEntryForRecruiter).mockResolvedValue(
    (options.journal ?? journalRow()) as never,
  );
  vi.mocked(buildPostGenerationInput).mockImplementation((params) => {
    const base: PostGenerationInput = {
      curriculum: {
        dayNumber: 1,
        topic: curriculumDay.topic,
        moduleNumber: 1,
        moduleTitle: moduleData.title,
        content: curriculumDay.content,
        subtopics: [],
        projectInformation: null,
        assessmentInformation: null,
      },
      journal: journalContext,
      brandVoice: { tone: [], avoid: [], style: [] },
      format: params.format,
      rules: {
        targetWordCount: { min: 100, max: 220 },
        maxHashtags: 5,
        shortParagraphs: true,
        avoidEmojis: true,
        avoidComplexVocabulary: true,
        noUnsupportedClaims: true,
        noInventedProjectResults: true,
        noInventedTechnologies: true,
        noInventedProblems: true,
        noInventedAchievements: true,
      },
    };
    return { ...base, recruiter: params.recruiter };
  });

  if (options.coreError !== undefined) {
    vi.mocked(generatePostFromPreparedInput).mockRejectedValue(options.coreError);
  } else {
    vi.mocked(generatePostFromPreparedInput).mockResolvedValue(options.coreResult ?? savedPost);
  }
  vi.mocked(updateContentOpportunityStatus).mockResolvedValue(
    { ...(options.opportunity ?? opportunityRow()), status: "generated" },
  );
}

function resetMocks() {
  vi.mocked(findGeneratedPostByOpportunity).mockReset();
  vi.mocked(loadCurriculumDayForRecruiter).mockReset();
  vi.mocked(loadModuleForRecruiter).mockReset();
  vi.mocked(loadJournalEntryForRecruiter).mockReset();
  vi.mocked(buildPostGenerationInput).mockReset();
  vi.mocked(generatePostFromPreparedInput).mockReset();
  vi.mocked(updateContentOpportunityStatus).mockReset();
}

beforeEach(() => {
  resetMocks();
});

// ─── B. Context Mapping (pure, deterministic) ────────────────────────────────

describe("buildRecruiterPostGenerationContext", () => {
  it("B. maps a project opportunity with evidence values + confidence + pages", () => {
    const context = buildRecruiterPostGenerationContext(
      opportunityRow(),
      journalContext,
      "project",
      { topic: "Git and Terminal Basics" },
    );

    expect(context.opportunityId).toBe("opp-1");
    expect(context.postType).toBe("PROJECT_SHOWCASE");
    expect(context.contentGoal).toBe("SHOW_PROJECTS");
    expect(context.title).toBe("Building Git Journal Tracker");
    expect(context.summary).toContain("CLI");
    expect(context.recruiterScore).toBe(88);
    expect(context.selectionReason).toContain("Strong implementation");
    expect(context.evidenceStrength).toBe("USER_CONFIRMED");
    expect(context.personalExperience).toBe(true);
    expect(context.format).toBe("project");
    expect(context.topic).toBe("Git and Terminal Basics");
    expect(context.dayNumber).toBe(1);

    expect(context.evidence).toHaveLength(2);
    const built = context.evidence.find((e) => e.field === "whatIBuilt")!;
    expect(built.value).toBe("Built a Git journal tracker that records my daily commits.");
    expect(built.confidence).toBe("USER_CONFIRMED");
    expect([...built.pageNumbers]).toEqual([3, 4]);

    const name = context.evidence.find((e) => e.field === "projectName")!;
    expect(name.value).toBe("Git Journal Tracker");
    expect(name.pageNumbers).toHaveLength(0);
  });

  it("keeps missing evidence values null and never invents text", () => {
    const context = buildRecruiterPostGenerationContext(
      opportunityRow({
        evidence: [{ field: "codeReference", pageNumbers: [2], confidence: "SUPPORTED_BY_PDF" }],
      }),
      journalContext,
      "challenge",
    );

    expect(context.evidence).toHaveLength(1);
    expect(context.evidence[0]!.field).toBe("codeReference");
    expect(context.evidence[0]!.value).toBeNull();
    expect([...context.evidence[0]!.pageNumbers]).toEqual([2]);
    expect(context.evidenceStrength).toBe("SUPPORTED_BY_PDF");
    expect(context.personalExperience).toBe(true);
  });

  it("derives the topic from the title when no curriculum topic is provided", () => {
    const context = buildRecruiterPostGenerationContext(opportunityRow(), journalContext, "project");
    expect(context.topic).toBe("Building Git Journal Tracker");
  });
});

// ─── Orchestration: Pipeline Reuse + Correct Parameters ─────────────────────

describe("generatePostFromOpportunity — orchestration", () => {
  it("A. delegates to the SHARED generation core (never a second pipeline)", async () => {
    stubMocks();
    const result = await generatePostFromOpportunity("opp-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.post).toBe(savedPost);
    expect(generatePostFromPreparedInput).toHaveBeenCalledTimes(1);
    expect(generatePostFromPreparedInput).toHaveBeenCalledWith(
      expect.objectContaining({
        dayNumber: 1,
        journalEntryId: "journal-1",
        format: "project",
        opportunityId: "opp-1",
      }),
    );
  });

  it("G. feeds the exact curriculum day, module, journal, format and recruiter context down", async () => {
    stubMocks();

    const result = await generatePostFromOpportunity("opp-1");
    expect(result.ok).toBe(true);

    expect(buildPostGenerationInput).toHaveBeenCalledTimes(1);
    const buildParams = vi.mocked(buildPostGenerationInput).mock.calls[0]![0];
    expect(buildParams.curriculumDay).toBe(curriculumDay);
    expect(buildParams.module).toBe(moduleData);
    expect(buildParams.journal).toMatchObject({ id: "journal-1", status: "submitted" });
    expect(buildParams.format).toBe("project");

    const recruiterCtx = buildParams.recruiter;
    expect(recruiterCtx).toBeDefined();
    expect(recruiterCtx!.opportunityId).toBe("opp-1");
    expect(recruiterCtx!.postType).toBe("PROJECT_SHOWCASE");
    expect(recruiterCtx!.personalExperience).toBe(true);
    expect(recruiterCtx!.format).toBe("project");

    const coreParams = vi.mocked(generatePostFromPreparedInput).mock.calls[0]![0];
    expect(coreParams.input.recruiter).toBe(recruiterCtx);
  });

  it("D. requires authentication", async () => {
    mockAuth(null);
    const result = await generatePostFromOpportunity("opp-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("AUTH_REQUIRED");
  });

  it("returns a not-found failure for a foreign/missing opportunity", async () => {
    mockOwnOpportunity([]);
    const result = await generatePostFromOpportunity("opp-ghost");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("OPPORTUNITY_NOT_FOUND");
    expect(generatePostFromPreparedInput).not.toHaveBeenCalled();
  });

  it("validates a non-empty opportunity id", async () => {
    stubMocks();
    const result = await generatePostFromOpportunity("   ");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("VALIDATION_ERROR");
    expect(generatePostFromPreparedInput).not.toHaveBeenCalled();
  });

  it("refuses generation when the journal for the day is not submitted", async () => {
    stubMocks({ journal: journalRow({ status: "draft" }) });
    const result = await generatePostFromOpportunity("opp-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("JOURNAL_NOT_SUBMITTED");
    expect(generatePostFromPreparedInput).not.toHaveBeenCalled();
    expect(updateContentOpportunityStatus).not.toHaveBeenCalled();
  });

  it("refuses an opportunity with no curriculum day", async () => {
    stubMocks({ opportunity: opportunityRow({ day_number: null }) });
    const result = await generatePostFromOpportunity("opp-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("OPPORTUNITY_INELIGIBLE");
  });

  it("rejects rejected opportunities", async () => {
    stubMocks({ opportunity: opportunityRow({ status: "rejected" }) });
    const result = await generatePostFromOpportunity("opp-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("OPPORTUNITY_INELIGIBLE");
    expect(generatePostFromPreparedInput).not.toHaveBeenCalled();
  });

  it("rejects approved opportunities", async () => {
    stubMocks({ opportunity: opportunityRow({ status: "approved" }) });
    const result = await generatePostFromOpportunity("opp-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("OPPORTUNITY_INELIGIBLE");
  });
});

// ─── Status Flow (K) ─────────────────────────────────────────────────────────

describe("generatePostFromOpportunity — status lifecycle", () => {
  it("K. advances candidate → generated ONLY after persistence", async () => {
    stubMocks({ opportunity: opportunityRow({ status: "candidate" }) });
    const result = await generatePostFromOpportunity("opp-1");
    expect(result.ok).toBe(true);
    expect(updateContentOpportunityStatus).toHaveBeenCalledWith("opp-1", "generated");
  });

  it("K. advances selected → generated on success", async () => {
    stubMocks({ opportunity: opportunityRow({ status: "selected" }) });
    const result = await generatePostFromOpportunity("opp-1");
    expect(result.ok).toBe(true);
    expect(updateContentOpportunityStatus).toHaveBeenCalledWith("opp-1", "generated");
  });

  it("K. never marks the opportunity generated when the core fails", async () => {
    stubMocks({ coreError: new AppError("boom", { code: "GENERATION_FAILED" }) });
    const result = await generatePostFromOpportunity("opp-1");
    expect(result.ok).toBe(false);
    expect(updateContentOpportunityStatus).not.toHaveBeenCalled();
  });

  it("K. does not re-update an already-generated opportunity", async () => {
    stubMocks({ opportunity: opportunityRow({ status: "generated" }) });
    const result = await generatePostFromOpportunity("opp-1");
    expect(result.ok).toBe(true);
    expect(updateContentOpportunityStatus).not.toHaveBeenCalled();
  });
});

// ─── Duplicate Protection (J) ────────────────────────────────────────────────

describe("generatePostFromOpportunity — duplicate protection", () => {
  it("J. returns the existing post and never generates a second one", async () => {
    stubMocks({ existingPost: savedPost });

    const result = await generatePostFromOpportunity("opp-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(false);
    expect(result.duplicate).toBe(true);
    expect(result.post).toBe(savedPost);
    expect(generatePostFromPreparedInput).not.toHaveBeenCalled();
    expect(updateContentOpportunityStatus).not.toHaveBeenCalled();
  });

  it("J. looks up the existing post for this exact opportunity before generating", async () => {
    stubMocks();
    const result = await generatePostFromOpportunity("opp-1");
    expect(result.ok).toBe(true);

    expect(findGeneratedPostByOpportunity).toHaveBeenCalledWith("opp-1");
    const lookupOrder = vi.mocked(findGeneratedPostByOpportunity).mock.invocationCallOrder[0]!;
    const coreOrder = vi.mocked(generatePostFromPreparedInput).mock.invocationCallOrder[0]!;
    expect(lookupOrder).toBeLessThan(coreOrder);
  });
});

// ─── Anti-Hallucination (E / F) ──────────────────────────────────────────────

describe("generatePostFromOpportunity — anti-hallucination gates", () => {
  it("E. refuses a personal-experience post type without USER_CONFIRMED evidence", async () => {
    stubMocks({
      opportunity: opportunityRow({
        evidence: [
          { field: "whatIBuilt", pageNumbers: [3, 4], confidence: "SUPPORTED_BY_PDF" },
        ],
      }),
    });

    const result = await generatePostFromOpportunity("opp-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.message).toContain("USER_CONFIRMED");
    expect(generatePostFromPreparedInput).not.toHaveBeenCalled();
    expect(updateContentOpportunityStatus).not.toHaveBeenCalled();
  });

  it("F. allows a learning post type from PDF-backed evidence", async () => {
    stubMocks({
      opportunity: opportunityRow({
        post_type: "TECHNICAL_LESSON",
        title: "Understanding Git staging",
        evidence: [
          { field: "whatILearned", pageNumbers: [1], confidence: "SUPPORTED_BY_PDF" },
        ],
      }),
    });

    const result = await generatePostFromOpportunity("opp-1");
    expect(result.ok).toBe(true);
    const buildParams = vi.mocked(buildPostGenerationInput).mock.calls[0]![0];
    expect(buildParams.recruiter!.postType).toBe("TECHNICAL_LESSON");
    expect(buildParams.recruiter!.personalExperience).toBe(false);
    expect(buildParams.recruiter!.evidenceStrength).toBe("SUPPORTED_BY_PDF");
  });

  it("M. masks unexpected/provider errors and never leaks raw messages or secrets", async () => {
    stubMocks({
      coreError: new AppError("Post generation failed: API key sk-abc123 invalid", {
        code: "GENERATION_FAILED",
      }),
    });

    const result = await generatePostFromOpportunity("opp-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("GENERATION_FAILED");
    expect(result.message).not.toContain("sk-abc123");
    expect(result.message).not.toContain("API key");
    expect(updateContentOpportunityStatus).not.toHaveBeenCalled();
  });
});

// ─── L. Format Mapping ───────────────────────────────────────────────────────

describe("selectFormatForPostType", () => {
  it("L. maps every post type to a format batch", () => {
    const cases: Array<[PostType, PostFormat]> = [
      ["PROJECT_SHOWCASE", "project"],
      ["API_INTEGRATION", "project"],
      ["AI_ENGINEERING", "project"],
      ["PROBLEM_SOLUTION", "challenge"],
      ["DEBUGGING_STORY", "challenge"],
      ["DEPLOYMENT_STORY", "challenge"],
      ["ENGINEERING_DECISION", "challenge"],
      ["TECHNICAL_LESSON", "concept"],
      ["SECURITY_LESSON", "practical-lesson"],
      ["DATABASE_ENGINEERING", "practical-lesson"],
      ["LEARNING_MILESTONE", "reflection"],
      ["CAREER_PROGRESS", "reflection"],
    ];
    for (const [postType, expected] of cases) {
      expect(selectFormatForPostType(postType)).toBe(expected);
    }
  });
});

// ─── Provider Level: Fallback Produces Evidence-Safe Opportunity Content ─────

const fallback = new TemplateFallbackProvider();

function opportunityInput(overrides?: Partial<PostGenerationInput>): PostGenerationInput {
  const context = buildRecruiterPostGenerationContext(
    opportunityRow(),
    journalContext,
    "project",
    { topic: "Git and Terminal Basics" },
  );
  return {
    curriculum: {
      dayNumber: 1,
      topic: "Git and Terminal Basics",
      moduleNumber: 1,
      moduleTitle: "Foundation: Git, Terminal, Python, OOP & DSA",
      content: "",
      subtopics: [],
      projectInformation: null,
      assessmentInformation: null,
    },
    journal: journalContext,
    brandVoice: { tone: ["authentic"], avoid: ["mastered"], style: ["short sentences"] },
    format: "project",
    rules: {
      targetWordCount: { min: 100, max: 220 },
      maxHashtags: 5,
      shortParagraphs: true,
      avoidEmojis: true,
      avoidComplexVocabulary: true,
      noUnsupportedClaims: true,
      noInventedProjectResults: true,
      noInventedTechnologies: true,
      noInventedProblems: true,
      noInventedAchievements: true,
    },
    recruiter: context,
    ...overrides,
  };
}

describe("TemplateFallbackProvider — opportunity post", () => {
  it("produces a deterministic, evidence-safe project post", async () => {
    const result = await fallback.generatePost(opportunityInput());
    const { post } = result.payload;

    expect(post.opening).toContain("Git Journal Tracker");
    expect(post.body).toContain("Git journal tracker that records my daily commits");
    expect(post.body).toContain("Key takeaway");
    expect(post.hashtags).toContain("#FullStackDevelopment");
    expect(post.hashtags).toContain("#105DaysOfCode");
    expect(post.hashtags.length).toBeLessThanOrEqual(5);
  });

  it("H/I. builds opportunity-driven image metadata + a post-type template", async () => {
    const { image } = (await fallback.generatePost(opportunityInput())).payload;
    expect(image.headline).toBe("Building Git Journal Tracker");
    expect(image.template).toBe("project-focused");
    expect(image.keywords).toContain("Git and Terminal Basics");
    expect(image.keywords).toContain("TypeScript");
  });

  it("F. never writes unsupported first-person achievements from PDF-only evidence", async () => {
    const context = buildRecruiterPostGenerationContext(
      opportunityRow({
        post_type: "TECHNICAL_LESSON",
        title: "Understanding Git staging",
        evidence: [{ field: "keyTakeaway", pageNumbers: [1], confidence: "SUPPORTED_BY_PDF" }],
      }),
      journalContext,
      "concept",
      { topic: "Git and Terminal Basics" },
    );
    const { post } = (await fallback.generatePost(opportunityInput({ recruiter: context }))).payload;

    const lower = `${post.opening}\n${post.body}`.toLowerCase();
    expect(lower).not.toMatch(/\bi (built|created|deployed|solved)\b/);
    expect(post.body).toMatch(/course material covered/i);
  });

  it("adds journey + platform hashtags and caps at the configured maximum", async () => {
    const { post } = (await fallback.generatePost(opportunityInput())).payload;
    expect(post.hashtags[0]).toBe("#FullStackDevelopment");
    expect(post.hashtags[1]).toBe("#105DaysOfCode");
    expect(post.hashtags.length).toBeLessThanOrEqual(5);
  });

  it("is deterministic for the same opportunity input", async () => {
    const a = await fallback.generatePost(opportunityInput());
    const b = await fallback.generatePost(opportunityInput());
    expect(a.payload.post).toEqual(b.payload.post);
    expect(a.payload.image).toEqual(b.payload.image);
  });
});