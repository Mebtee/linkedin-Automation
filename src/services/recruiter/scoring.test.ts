import { describe, expect, it } from "vitest";
import type { OpportunityScoringInput, OpportunityDimensions, ScoredOpportunity, DimensionEvidence } from "@/types/content-opportunity";
import { DEFAULT_CONTENT_GOAL, POST_TYPES } from "@/types/content-opportunity";
import type { EvidenceType } from "@/types/course-material";
import { recruiter } from "@/config/recruiter";
import { computeRecruiterScore, scoreOpportunities, selectStrongestOpportunity } from "./scoring";

function dim(present: boolean, confidence: EvidenceType): DimensionEvidence {
  return { present, confidence };
}

function allConfirmed(): OpportunityDimensions {
  return {
    realImplementationEvidence: dim(true, "USER_CONFIRMED"),
    problemSolvingEvidence: dim(true, "USER_CONFIRMED"),
    technicalDepth: dim(true, "USER_CONFIRMED"),
    productionDeploymentRelevance: dim(true, "USER_CONFIRMED"),
    securityEngineeringQuality: dim(true, "USER_CONFIRMED"),
    multipleSkills: dim(true, "USER_CONFIRMED"),
    communicationTeachingValue: dim(true, "USER_CONFIRMED"),
    uniqueness: dim(true, "USER_CONFIRMED"),
  };
}

function onlyKnowledge(): OpportunityDimensions {
  return {
    realImplementationEvidence: dim(false, "MISSING"),
    problemSolvingEvidence: dim(false, "MISSING"),
    technicalDepth: dim(true, "SUPPORTED_BY_PDF"),
    productionDeploymentRelevance: dim(false, "MISSING"),
    securityEngineeringQuality: dim(false, "MISSING"),
    multipleSkills: dim(true, "SUPPORTED_BY_PDF"),
    communicationTeachingValue: dim(true, "SUPPORTED_BY_PDF"),
    uniqueness: dim(true, "USER_CONFIRMED"),
  };
}

function makeInput(overrides: Partial<OpportunityScoringInput> = {}): OpportunityScoringInput {
  return {
    id: "op-1",
    postType: "PROJECT_SHOWCASE",
    topic: "Supabase RLS permission bug",
    summary: "Investigated a 42501 permission error caused by revoked table-level grants.",
    evidenceStrength: "USER_CONFIRMED",
    dimensions: allConfirmed(),
    skillCodes: ["supabase", "postgresql", "typescript"],
    recentPostTypes: [],
    recentTopics: [],
    ...overrides,
  };
}

describe("Phase 5A — content taxonomy", () => {
  it("defines all twelve recruiter post types", () => {
    expect(POST_TYPES).toHaveLength(12);
  });

  it("defaults the content goal to get recruiter attention", () => {
    expect(DEFAULT_CONTENT_GOAL).toBe("GET_RECRUITER_ATTENTION");
  });

  it("always recommends the platform hashtag within the 3–5 limit", () => {
    expect(recruiter.hashtags.platform).toContain("#FullStackDevelopment");
    expect(recruiter.hashtags.min).toBeGreaterThanOrEqual(1);
    expect(recruiter.hashtags.max).toBeLessThanOrEqual(5);
    expect(recruiter.hashtags.min).toBeLessThanOrEqual(recruiter.hashtags.max);
  });
});

describe("Phase 5A — recruiter relevance scoring", () => {
  it("scores real project evidence higher than generic learning", () => {
    const project = makeInput({ id: "project", postType: "PROJECT_SHOWCASE" });
    const learning = makeInput({
      id: "learning",
      postType: "TECHNICAL_LESSON",
      dimensions: onlyKnowledge(),
    });

    const projectScore = computeRecruiterScore(project, { goal: "BALANCED" }).total;
    const learningScore = computeRecruiterScore(learning, { goal: "BALANCED" }).total;

    expect(projectScore).toBeGreaterThan(learningScore);
  });

  it("gives problem-solving evidence its full weight", () => {
    const withProblem = makeInput({ id: "with" });
    const withoutProblem = makeInput({
      id: "without",
      dimensions: { ...allConfirmed(), problemSolvingEvidence: dim(false, "MISSING") },
    });

    const withScore = computeRecruiterScore(withProblem, { goal: "BALANCED" }).total;
    const withoutScore = computeRecruiterScore(withoutProblem, { goal: "BALANCED" }).total;

    expect(withScore - withoutScore).toBe(20);
  });

  it("never lets unsupported claims increase the score", () => {
    const inferredA = makeInput({
      id: "A",
      postType: "DEBUGGING_STORY",
      evidenceStrength: "INFERRED_FROM_STRUCTURE",
      dimensions: { ...allConfirmed(), problemSolvingEvidence: dim(true, "INFERRED_FROM_STRUCTURE") },
    });
    const inferredB = makeInput({
      id: "B",
      postType: "DEBUGGING_STORY",
      evidenceStrength: "INFERRED_FROM_STRUCTURE",
      dimensions: { ...allConfirmed(), problemSolvingEvidence: dim(false, "INFERRED_FROM_STRUCTURE") },
    });

    const a = computeRecruiterScore(inferredA, { goal: "BALANCED" });
    const b = computeRecruiterScore(inferredB, { goal: "BALANCED" });

    expect(a.total).toBe(b.total);
    expect(a.eligible).toBe(false);
    expect(b.eligible).toBe(false);
    expect(a.authenticityFlags.length).toBeGreaterThan(0);
  });

  it("keeps MISSING evidence from becoming a personal claim", () => {
    const missing = makeInput({ evidenceStrength: "MISSING" });
    const score = computeRecruiterScore(missing, { goal: "BALANCED" });

    expect(score.eligible).toBe(false);
    expect(score.authenticityFlags.join(" ")).toMatch(/No evidence/);
  });

  it("treats USER_CONFIRMED as authoritative over SUPPORTED_BY_PDF", () => {
    const confirmed = makeInput({ id: "confirmed" });
    const supported = makeInput({
      id: "supported",
      evidenceStrength: "SUPPORTED_BY_PDF",
      dimensions: { ...allConfirmed(), realImplementationEvidence: dim(true, "SUPPORTED_BY_PDF") },
    });

    const confirmedScore = computeRecruiterScore(confirmed, { goal: "BALANCED" });
    const supportedScore = computeRecruiterScore(supported, { goal: "BALANCED" });

    expect(confirmedScore.total).toBeGreaterThan(supportedScore.total);
    expect(confirmedScore.eligible).toBe(true);
    expect(supportedScore.eligible).toBe(false);
  });

  it("keeps the score deterministic for identical input", () => {
    const input = makeInput();
    expect(computeRecruiterScore(input, { goal: "BALANCED" })).toEqual(
      computeRecruiterScore(input, { goal: "BALANCED" }),
    );
  });

  it("caps the score at 100", () => {
    const maxed = makeInput({
      skillCodes: ["nextjs", "supabase", "typescript", "postgresql", "auth", "vercel"],
    });
    const score = computeRecruiterScore(maxed, { goal: "GET_RECRUITER_ATTENTION" });

    expect(score.total).toBe(100);
    expect(score.total).toBeLessThanOrEqual(100);
    expect(score.total).toBeGreaterThanOrEqual(0);
  });

  it("rewards multiple distinct demonstrated skills proportionally", () => {
    const fewSkills = makeInput({ skillCodes: ["a"] });
    const manySkills = makeInput({
      skillCodes: ["a", "b", "c", "d", "e", "f"],
    });

    const few = computeRecruiterScore(fewSkills, { goal: "BALANCED" });
    const many = computeRecruiterScore(manySkills, { goal: "BALANCED" });

    expect(many.total).toBeGreaterThan(few.total);
  });

  it("lets the content goal nudge the weights", () => {
    const input = makeInput();

    const projects = computeRecruiterScore(input, { goal: "SHOW_PROJECTS" });
    const balanced = computeRecruiterScore(input, { goal: "BALANCED" });

    expect(projects.dimensions.realImplementationEvidence).toBe(30);
    expect(balanced.dimensions.realImplementationEvidence).toBe(25);
  });

  it("rejects weak evidence below the recommendation threshold", () => {
    const weak = makeInput({ id: "weak", postType: "TECHNICAL_LESSON", dimensions: onlyKnowledge() });
    const score = computeRecruiterScore(weak, { goal: "BALANCED" });

    expect(score.total).toBeLessThan(recruiter.minRecommendScore);
    expect(score.eligible).toBe(false);
  });
});

describe("Phase 5A — diversity and selection", () => {
  it("penalizes repeated post types", () => {
    const fresh = makeInput({ id: "fresh" });
    const repeated = makeInput({ id: "repeated", recentPostTypes: ["PROJECT_SHOWCASE"] });

    const freshScore = computeRecruiterScore(fresh, { goal: "BALANCED" });
    const repeatedScore = computeRecruiterScore(repeated, { goal: "BALANCED" });

    expect(freshScore.total).toBeGreaterThan(repeatedScore.total);
    expect(freshScore.dimensions.uniqueness).toBe(5);
    expect(repeatedScore.dimensions.uniqueness).toBeLessThan(5);
  });

  it("does not let diversity override stronger evidence", () => {
    const strongButRepeated = makeInput({
      id: "strong",
      recentPostTypes: ["PROJECT_SHOWCASE", "PROJECT_SHOWCASE"],
    });
    const freshButWeak = makeInput({
      id: "weak",
      postType: "TECHNICAL_LESSON",
      dimensions: onlyKnowledge(),
      recentPostTypes: [],
    });

    const scored = scoreOpportunities([strongButRepeated, freshButWeak], { goal: "BALANCED" });
    const recommendation = selectStrongestOpportunity(scored);

    expect(recommendation).not.toBeNull();
    expect(recommendation!.opportunity.id).toBe("strong");
    expect(recommendation!.diversityAdjusted).toBe(true);
  });

  it("selects the strongest eligible opportunity with a concise reason", () => {
    const project = makeInput({ id: "project" });
    const learning = makeInput({
      id: "learning",
      postType: "TECHNICAL_LESSON",
      dimensions: onlyKnowledge(),
      recentPostTypes: ["PROJECT_SHOWCASE"],
    });

    const scored = scoreOpportunities([learning, project], { goal: "BALANCED" });
    const recommendation = selectStrongestOpportunity(scored)!;

    expect(recommendation.opportunity.id).toBe("project");
    expect(recommendation.reason).toMatch(/^Recommended because/);
    expect(recommendation.reason.length).toBeLessThan(200);
  });

  it("returns null when every opportunity is ineligible", () => {
    const allWeak = scoreOpportunities(
      [
        makeInput({ id: "a", postType: "TECHNICAL_LESSON", dimensions: onlyKnowledge() }),
        makeInput({ id: "b", evidenceStrength: "MISSING" }),
      ],
      { goal: "BALANCED" },
    );

    expect(selectStrongestOpportunity(allWeak)).toBeNull();
  });

  it("resolves ties deterministically to the earliest opportunity", () => {
    const first = makeInput({ id: "first" });
    const second = makeInput({
      id: "second",
      topic: "another strong opportunity",
      summary: "Another strong opportunity with identical score.",
    });

    const recommendation = selectStrongestOpportunity(scoreOpportunities([first, second], { goal: "BALANCED" }));

    expect(recommendation!.opportunity.id).toBe("first");
  });

  it("exposes only concise dimension-based reasons, never raw reasoning traces", () => {
    const scored = scoreOpportunities([makeInput()], { goal: "BALANCED" });
    const reason = selectStrongestOpportunity(scored)!.reason;

    expect(reason).not.toMatch(/confidence|factor|weights|rail/i);
    expect(reason).not.toContain("chain");
  });
});

describe("Phase 5A — score bounds", () => {
  it("stays within 0–100 across goal variations", () => {
    const goals = ["GET_RECRUITER_ATTENTION", "BUILD_TECHNICAL_CREDIBILITY", "SHOW_PROJECTS", "SHOW_PROBLEM_SOLVING", "DOCUMENT_LEARNING", "BALANCED"] as const;
    const inputs: ScoredOpportunity[] = [
      ...scoreOpportunities([makeInput()]),
      ...scoreOpportunities([makeInput({ dimensions: onlyKnowledge(), postType: "TECHNICAL_LESSON" })]),
    ];

    for (const goal of goals) {
      for (const input of inputs) {
        const score = computeRecruiterScore(input, { goal });
        expect(score.total).toBeGreaterThanOrEqual(0);
        expect(score.total).toBeLessThanOrEqual(100);
      }
    }
  });
});