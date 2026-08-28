import { describe, it, expect } from "vitest";

import {
  buildQualityResult,
  evaluateApproveGate,
  evaluateRecruiterPost,
  findAvoidWords,
  qualityReportForPost,
  validateRecruiterHashtags,
} from "./quality";
import type { QualityPostInput } from "./quality";
import { recruiterQuality } from "@/config/recruiter";
import { RECRUITER_QUALITY_DIMENSIONS } from "@/types/recruiter-quality";
import type { RecruiterPostGenerationContext } from "@/types/content-opportunity";
import type { JournalContext } from "@/types/ai";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const journalContext: JournalContext = {
  whatILearned: "I learned how git staging works and why small, frequent commits matter.",
  whatIPracticed: "I practiced committing with clear messages.",
  whatIBuilt: "I built the Git Journal Tracker, a small CLI that records my daily commits.",
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

const CONFIRMED = (field: string, value: string) => ({
  field,
  value,
  confidence: "USER_CONFIRMED" as const,
  pageNumbers: [] as readonly number[],
});

function makeContext(
  overrides: Partial<RecruiterPostGenerationContext> = {},
): RecruiterPostGenerationContext {
  const chance = CONFIRMED;
  return {
    opportunityId: "op-1",
    postType: "PROJECT_SHOWCASE",
    contentGoal: "SHOW_PROJECTS",
    title: "Building Git Journal Tracker",
    summary: "A small CLI that tracks my learning journal in Git history.",
    recruiterScore: 90,
    recruiterScoreBreakdown: null,
    selectionReason: "Strong implementation evidence, personally confirmed.",
    evidence: [
      chance("whatIBuilt", "Git Journal Tracker CLI records my daily commits."),
      chance("projectName", "Git Journal Tracker"),
      chance("challenge", "A merge conflict confused me mid-project."),
      chance("howISolvedIt", "I resolved the conflict keeping both changes."),
      chance("whatILearned", "Git staging and small frequent commits matter."),
    ],
    evidenceStrength: "USER_CONFIRMED",
    personalExperience: true,
    journal: journalContext,
    dayNumber: 1,
    topic: "Git and Terminal Basics",
    format: "project",
    ...overrides,
  };
}

function makePost(overrides: Partial<QualityPostInput> = {}): QualityPostInput {
  return {
    opening: "I built the Git Journal Tracker, a small CLI that turns daily commits into a readable history.",
    body:
      "The tool records a git commit for each learning day so progress becomes visible. " +
      "The hardest part was a merge conflict: my branch and main both changed, and git refused to " +
      "merge. I inspected the diff with git log and resolved it by keeping both changes. " +
      "The integration uses git and node, and the CLI is available from the terminal.",
    takeaway: "Small, frequent commits turn learning into a visible timeline.",
    nextStep: "Learn branches and merging so conflicts are easier to handle.",
    hashtags: ["#FullStackDevelopment", "#105DaysOfCode", "#Git"],
    ...overrides,
  };
}

// ─── Determinism + safety ────────────────────────────────────────────────────

describe("evaluateRecruiterPost — determinism and safety", () => {
  it("is deterministic: identical (post, context) inputs produce identical results", () => {
    const a = evaluateRecruiterPost(makePost(), makeContext());
    const b = evaluateRecruiterPost(makePost(), makeContext());
    expect(a).toEqual(b);
  });

  it("keeps every dimension and the total within 0–100", () => {
    const result = evaluateRecruiterPost(makePost(), makeContext());
    for (const dimension of RECRUITER_QUALITY_DIMENSIONS) {
      expect(result.dimensions[dimension]).toBeGreaterThanOrEqual(0);
      expect(result.dimensions[dimension]).toBeLessThanOrEqual(100);
    }
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
  });

  it("produces only the safe report shape — no prompts, no chain of thought", () => {
    const report = qualityReportForPost(
      { ...makePost(), next_step: makePost().nextStep },
      makeContext(),
      "2026-08-28T00:00:00.000Z",
    );
    expect(report.recommendation).toBe("strong");
    expect(report.evaluatedAt).toBe("2026-08-28T00:00:00.000Z");
    expect(report.warnings.every((w) => !w.includes("prompt") && !w.includes("reasoning"))).toBe(true);
    const keys = Object.keys(report).sort();
    expect(keys).toEqual(
      ["dimensions", "evaluatedAt", "improvements", "recommendation", "score", "strengths", "warnings"].sort(),
    );
  });
});

// ─── Evidence + anti-hallucination ───────────────────────────────────────────

describe("evidence ranking and anti-hallucination gates", () => {
  it("scores evidence strength by confidence rank: USER_CONFIRMED > SUPPORTED_BY_PDF > INFERRED > MISSING", () => {
    const rank = (confidence: "USER_CONFIRMED" | "SUPPORTED_BY_PDF" | "INFERRED_FROM_STRUCTURE" | "MISSING") => {
      const ctx = makeContext({
        evidenceStrength: confidence,
        evidence: [{ field: "whatILearned", value: "react hooks", confidence, pageNumbers: [] }],
        journal: { ...journalContext, whatIBuilt: null, projectName: null },
        personalExperience: false,
        postType: "TECHNICAL_LESSON",
      });
      return evaluateRecruiterPost(makePost(), ctx).dimensions.evidenceStrength;
    };
    const confirmed = rank("USER_CONFIRMED");
    const pdf = rank("SUPPORTED_BY_PDF");
    const inferred = rank("INFERRED_FROM_STRUCTURE");
    const missing = rank("MISSING");
    expect(confirmed).toBeGreaterThan(pdf);
    expect(pdf).toBeGreaterThan(inferred);
    expect(inferred).toBeGreaterThan(missing);
  });

  it("flags an unsupported personal achievement claim as CRITICAL → do_not_publish", () => {
    const post = makePost({
      opening: "I built a production-grade distributed database.",
      body: "I implemented consensus and shipped it to thousands of users.",
    });
    const result = evaluateRecruiterPost(post, makeContext());
    expect(result.hasCriticalWarning).toBe(true);
    expect(result.publishRecommendation).toBe("do_not_publish");
    expect(result.warnings.some((w) => w.startsWith("Critical:"))).toBe(true);
  });

  it("does not flag an achievement claim backed by USER_CONFIRMED evidence", () => {
    const post = makePost({
      opening: "I built the Git Journal Tracker, a small CLI for tracking daily commits.",
    });
    const result = evaluateRecruiterPost(post, makeContext());
    expect(result.hasCriticalWarning).toBe(false);
    expect(result.publishRecommendation).not.toBe("do_not_publish");
  });

  it("does not treat 'the framework is built this way' as a personal claim", () => {
    const post = makePost({
      opening: "I finally understand why the framework is built this way.",
      body: "The router runs before the render pass, which is why state felt stale.",
    });
    const result = evaluateRecruiterPost(post, makeContext({ postType: "TECHNICAL_LESSON", personalExperience: false }));
    expect(result.hasCriticalWarning).toBe(false);
  });

  it("treats 'I mastered …' as a NON-critical warning (not do_not_publish)", () => {
    const post = makePost({
      body: makePost().body + " I mastered git merge in a few hours.",
    });
    const result = evaluateRecruiterPost(post, makeContext());
    expect(result.hasCriticalWarning).toBe(false);
    expect(result.publishRecommendation).not.toBe("do_not_publish");
    expect(result.warnings.some((w) => /master/i.test(w))).toBe(true);
  });

  it("a missing required section is CRITICAL even when the rest is strong", () => {
    const result = evaluateRecruiterPost(
      makePost({ nextStep: "   " }),
      makeContext(),
    );
    expect(result.hasCriticalWarning).toBe(true);
    expect(result.publishRecommendation).toBe("do_not_publish");
  });

  it("quality score never overrides evidence safety: buildQualityResult blocks on critical", () => {
    const strong = Object.fromEntries(
      RECRUITER_QUALITY_DIMENSIONS.map((d) => [d, 95]),
    ) as Record<typeof RECRUITER_QUALITY_DIMENSIONS[number], number>;
    const withCritical = buildQualityResult(strong, { hasCriticalWarning: true });
    expect(withCritical.publishRecommendation).toBe("do_not_publish");
  });
});

// ─── Content signals ─────────────────────────────────────────────────────────

describe("content-signal dimensions", () => {
  it("rewards concrete technical vocabulary", () => {
    const technical = evaluateRecruiterPost(
      makePost({ body: "The CLI uses node, git, and sqlite and exposes a REST api over http." }),
      makeContext(),
    ).dimensions.technicalDepth;
    const vague = evaluateRecruiterPost(
      makePost({ body: "I did a fun thing today and it went okay." }),
      makeContext(),
    ).dimensions.technicalDepth;
    expect(technical).toBeGreaterThan(vague);
  });

  it("lowers clarity for generic openers, very long sentences, emoji, and bad hashtags", () => {
    const clean = evaluateRecruiterPost(makePost(), makeContext()).dimensions.clarity;
    const rough = evaluateRecruiterPost(
      makePost({
        opening: "Another amazing day of learning! 🚀".repeat(1),
        body: "This single sentence has no punctuation and just keeps going and going without any breaks whatsoever " + "and it carries on far beyond forty five words so the reader loses the thread entirely " + "and the opening gave away nothing about the actual topic of the post which was git.",
        hashtags: ["#motivation", "#hustle"],
      }),
      makeContext(),
    ).dimensions.clarity;
    expect(clean).toBeGreaterThan(rough);
  });

  it("boosts authenticity for honest growth language and penalizes hype words", () => {
    const honest = evaluateRecruiterPost(
      makePost({ body: "Still learning git. After a few failed attempts, it finally worked." }),
      makeContext(),
    ).dimensions.authenticity;
    const hype = evaluateRecruiterPost(
      makePost({ body: "Absolutely crushed it today — game-changing, world-class productivity." }),
      makeContext(),
    ).dimensions.authenticity;
    expect(honest).toBeGreaterThan(hype);
    expect(findAvoidWords(makePost({ body: "Game-changing, world-class productivity." }))).toContain("game-changing");
  });

  it("weights recruiter relevance by the opportunity score", () => {
    const low = evaluateRecruiterPost(makePost(), makeContext({ recruiterScore: 40 })).dimensions.recruiterRelevance;
    const high = evaluateRecruiterPost(makePost(), makeContext({ recruiterScore: 95 })).dimensions.recruiterRelevance;
    expect(high).toBeGreaterThan(low);
  });

  it("rewards visible learning + a next step in learningGrowth", () => {
    const grown = evaluateRecruiterPost(makePost(), makeContext()).dimensions.learningGrowth;
    const flat = evaluateRecruiterPost(
      makePost({ body: "Just another day. Nothing new to report." }),
      makeContext({ journal: { ...journalContext, whatILearned: null, keyTakeaway: null, tomorrowFocus: null } }),
    ).dimensions.learningGrowth;
    expect(grown).toBeGreaterThan(flat);
  });
});

// ─── Recommendation thresholds ───────────────────────────────────────────────

describe("publish recommendation thresholds", () => {
  const dims = (value: number) =>
    Object.fromEntries(RECRUITER_QUALITY_DIMENSIONS.map((d) => [d, value])) as Record<
      typeof RECRUITER_QUALITY_DIMENSIONS[number],
      number
    >;

  it("maps ≥80 → strong, 70–79 → ready, 55–69 → needs_review, <55 → do_not_publish", () => {
    expect(buildQualityResult(dims(80), { hasCriticalWarning: false }).publishRecommendation).toBe("strong");
    expect(buildQualityResult(dims(70), { hasCriticalWarning: false }).publishRecommendation).toBe("ready");
    expect(buildQualityResult(dims(60), { hasCriticalWarning: false }).publishRecommendation).toBe("needs_review");
    expect(buildQualityResult(dims(50), { hasCriticalWarning: false }).publishRecommendation).toBe("do_not_publish");
    expect(buildQualityResult(dims(64), { hasCriticalWarning: false }).publishRecommendation).toBe("needs_review");
  });

  it("is weighted by the config: weights sum to 100 and drive the total", () => {
    const weights = recruiterQuality.weights;
    const sum = RECRUITER_QUALITY_DIMENSIONS.reduce((acc, d) => acc + weights[d], 0);
    expect(sum).toBe(100);
    const result = buildQualityResult(dims(50), { hasCriticalWarning: false });
    expect(result.totalScore).toBe(50);
  });
});

// ─── Approve gate ───────────────────────────────────────────────────────────

describe("evaluateApproveGate", () => {
  const report = (recommendation: "strong" | "ready" | "needs_review" | "do_not_publish") => ({
    score: 80,
    recommendation,
    dimensions: Object.fromEntries(
      RECRUITER_QUALITY_DIMENSIONS.map((d) => [d, 80]),
    ) as Record<typeof RECRUITER_QUALITY_DIMENSIONS[number], number>,
    strengths: [],
    improvements: [],
    warnings: recommendation === "do_not_publish" ? ["Critical: unsupported achievement claim."] : [],
    evaluatedAt: "2026-08-28T00:00:00Z",
  });

  it("allows posts without a report (journal-only posts)", () => {
    expect(evaluateApproveGate(null).allowed).toBe(true);
    expect(evaluateApproveGate(undefined).allowed).toBe(true);
  });

  it("allows strong, ready, and needs_review", () => {
    expect(evaluateApproveGate(report("strong")).allowed).toBe(true);
    expect(evaluateApproveGate(report("ready")).allowed).toBe(true);
    expect(evaluateApproveGate(report("needs_review")).allowed).toBe(true);
  });

  it("blocks do_not_publish with the critical warning as the message", () => {
    const gate = evaluateApproveGate(report("do_not_publish"));
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) {
      expect(gate.code).toBe("QUALITY_GATE_BLOCKED");
      expect(gate.message).toContain("unsupported achievement claim");
    }
  });
});

// ─── Hashtag validation ───────────────────────────────────────────────────────

describe("validateRecruiterHashtags", () => {
  it("accepts 3–5 relevant tags including #FullStackDevelopment and the journey tag", () => {
    const result = validateRecruiterHashtags(
      ["#FullStackDevelopment", "#105DaysOfCode", "#Git"],
      { journey: true },
    );
    expect(result.warnings).toHaveLength(0);
  });

  it("warns when #FullStackDevelopment is missing", () => {
    const result = validateRecruiterHashtags(["#Git", "#NextJS"], { journey: true });
    expect(result.warnings.some((w) => w.includes("#FullStackDevelopment"))).toBe(true);
  });

  it("warns when a journey post omits #105DaysOfCode", () => {
    const result = validateRecruiterHashtags(["#FullStackDevelopment", "#Git", "#NextJS"], { journey: true });
    expect(result.warnings.some((w) => w.includes("#105DaysOfCode"))).toBe(true);
  });

  it("warns on fewer than 3 or more than 5 tags", () => {
    expect(validateRecruiterHashtags(["#FullStackDevelopment"], {}).warnings.length).toBeGreaterThan(0);
    expect(
      validateRecruiterHashtags(["#1", "#2", "#3", "#4", "#5", "#6"], {}).warnings.length,
    ).toBeGreaterThan(0);
  });

  it("warns on irrelevant 'reach' hashtags", () => {
    const result = validateRecruiterHashtags(["#FullStackDevelopment", "#105DaysOfCode", "#motivation"], {});
    expect(result.warnings.some((w) => w.includes("irrelevant"))).toBe(true);
  });

  it("warns on tags without a leading #", () => {
    const result = validateRecruiterHashtags(["FullStackDevelopment", "#Git"], {});
    expect(result.warnings.some((w) => w.includes('"#'))).toBe(true);
  });
});