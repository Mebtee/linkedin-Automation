// ─── Recruiter Post Quality Evaluator (Phase 5D) ─────────────────────────────
// Deterministic, no-LLM evaluation of a generated post against the selected
// content opportunity. This file is PURE: no database, no providers, no
// randomness. Identical (post, context) inputs produce identical results.
//
// Design rules:
//   - Weights and thresholds come ONLY from `src/config/recruiter.ts`.
//   - Anti-hallucination charges CANNOT be outvoted by score: an unsupported
//     personal achievement claim is a critical warning → "do_not_publish"
//     regardless of the total score.
//   - The result exposure is safe: strengths / improvements / warnings are
//     pre-authored and never contain prompts or hidden reasoning.
//
// Evidence rules (Phase 5A contract, carried unchanged):
//   - Only USER_CONFIRMED enrichment can support first-person achievement.
//   - SUPPORTED_BY_PDF / INFERRED_FROM_STRUCTURE support learning content only.

import { content } from "@/config/content";
import { POST_TYPE_META, recruiter, recruiterQuality } from "@/config/recruiter";
import type { RecruiterPostGenerationContext } from "@/types/content-opportunity";
import type {
  PublishRecommendation,
  RecruiterQualityDimension,
  RecruiterQualityReport,
  RecruiterQualityResult,
} from "@/types/recruiter-quality";
import { RECRUITER_QUALITY_DIMENSIONS } from "@/types/recruiter-quality";

// ─── Input shape ──────────────────────────────────────────────────────────────

export type QualityPostInput = {
  readonly opening: string;
  readonly body: string;
  readonly takeaway: string;
  readonly nextStep: string;
  readonly hashtags: readonly string[];
};

// ─── Field buckets ────────────────────────────────────────────────────────────

const PRACTICAL_FIELDS: ReadonlySet<string> = new Set([
  "whatIBuilt",
  "projectName",
  "projectDescription",
  "whatIPracticed",
  "codeReference",
]);

const LEARNING_FIELDS: ReadonlySet<string> = new Set([
  "whatILearned",
  "keyTakeaway",
  "tomorrowFocus",
]);

const EVIDENCE_BASE: Record<string, number> = {
  USER_CONFIRMED: 100,
  SUPPORTED_BY_PDF: 70,
  INFERRED_FROM_STRUCTURE: 45,
  MISSING: 0,
};

const STOPWORDS: ReadonlySet<string> = new Set([
  "the", "and", "for", "with", "that", "this", "from", "your", "into", "then",
  "was", "are", "than", "when", "about", "after", "before", "they", "them",
  "have", "been", "being", "were", "will", "would", "could", "should", "there",
  "their", "those", "these", "what", "which", "while", "where", "each", "more",
  "most", "some", "such", "only", "just", "also", "even", "once", "then",
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fullText(post: QualityPostInput): string {
  return [post.opening, post.body, post.takeaway, post.nextStep]
    .filter((part) => hasText(part))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function countLongSentences(text: string, maxWords = 45): number {
  return sentences(text).filter((sentence) => wordCount(sentence) > maxWords).length;
}

function contentWords(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3 && !STOPWORDS.has(word));
}

/** True when two texts share a meaningful content word (>3 chars, non-stopword). */
function sharesContentWord(a: string, b: string): boolean {
  const wordsB = new Set(contentWords(b));
  return contentWords(a).some((word) => wordsB.has(word));
}

// ─── Detection ────────────────────────────────────────────────────────────────

/**
 * Detects first-person personal-achievement claims such as "I built …".
 * Uses a small deterministic window between the pronoun and the verb so that
 * phrases like "I finally understand why the framework is built this way" are
 * NOT treated as achievement claims.
 */
function findAchievementClaims(post: QualityPostInput): string[] {
  const text = fullText(post);
  const claims: string[] = [];
  const pronoun = "\\b(?:i|we)\\b";
  const verbs = recruiterQuality.achievementVerbs.join("|");
  const pattern = new RegExp(`${pronoun}[^.!?]{0,18}?\\b(?:${verbs})\\b`, "gi");

  let match = pattern.exec(text);
  while (match) {
    const start = Math.max(0, match.index - 40);
    claims.push(text.slice(start, match.index + 40));
    match = pattern.exec(text);
  }
  return claims;
}

function hasGenericOpener(post: QualityPostInput): boolean {
  const lower = fullText(post).toLowerCase();
  return recruiterQuality.genericOpeners.some((opener) => lower.includes(opener));
}

function countAvoidWords(post: QualityPostInput): string[] {
  const lower = fullText(post).toLowerCase();
  return content.brandVoice.avoid.filter((word) => {
    const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`);
    return pattern.test(lower);
  });
}

function countHonestGrowth(post: QualityPostInput): number {
  const lower = fullText(post).toLowerCase();
  return recruiterQuality.honestGrowthPhrases.filter((phrase) =>
    lower.includes(phrase),
  ).length;
}

function countTechnicalMatches(post: QualityPostInput): number {
  const lower = fullText(post).toLowerCase();
  const matched = recruiterQuality.technicalTerms.filter((term) => {
    const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`);
    return pattern.test(lower);
  });
  return matched.length;
}

function hasFirstPerson(post: QualityPostInput): boolean {
  return /\b(i'?m|i|my|we)\b/.test(fullText(post));
}

function hasAnyEmoji(post: QualityPostInput): boolean {
  return /[\p{Extended_Pictographic}]/u.test(fullText(post));
}

// ─── Hashtag validation ───────────────────────────────────────────────────────

/**
 * Validates a post's hashtags against the Phase 5 rules:
 *   - always #FullStackDevelopment,
 *   - #105DaysOfCode on journey posts,
 *   - 3–5 total,
 *   - no irrelevant popular "reach" tags,
 *   - every tag starts with #.
 * Returns deterministic warnings (used by the evaluator and the UI).
 */
export function validateRecruiterHashtags(
  hashtags: readonly string[],
  options: { readonly journey?: boolean } = {},
): { readonly warnings: string[]; readonly count: number } {
  const warnings: string[] = [];
  const normalized = hashtags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  if (normalized.length === 0) {
    warnings.push("Add 3–5 relevant hashtags.");
    return { warnings, count: 0 };
  }

  const missingHash = normalized.filter((tag) => !tag.startsWith("#"));
  if (missingHash.length > 0) {
    warnings.push(`Each hashtag must start with "#" (found: ${missingHash.join(", ")}).`);
  }

  const lower = normalized.map((tag) => tag.toLowerCase());
  if (!lower.includes("#fullstackdevelopment")) {
    warnings.push("Hashtags must include #FullStackDevelopment.");
  }
  if (options.journey && !lower.includes("#105daysofcode")) {
    warnings.push("Journey posts should include #105DaysOfCode.");
  }
  if (
    normalized.length < recruiter.hashtags.min ||
    normalized.length > recruiter.hashtags.max
  ) {
    warnings.push(
      `Keep ${recruiter.hashtags.min}–${recruiter.hashtags.max} hashtags (found ${normalized.length}).`,
    );
  }

  const irrelevant = lower.filter((tag) =>
    (recruiterQuality.irrelevantHashtags as readonly string[]).includes(tag),
  );
  if (irrelevant.length > 0) {
    warnings.push(
      `Remove irrelevant reach hashtags (${irrelevant.join(", ")}); keep only topic-relevant tags.`,
    );
  }

  return { warnings, count: normalized.length };
}

// ─── Per-dimension scorers (each returns 0–100) ──────────────────────────────

/** True when any evidence entry for the given fields is USER_CONFIRMED with text. */
function hasConfirmedEvidence(
  ctx: RecruiterPostGenerationContext,
  fields: ReadonlySet<string>,
): boolean {
  return ctx.evidence.some(
    (entry) => fields.has(entry.field) && entry.confidence === "USER_CONFIRMED" && hasText(entry.value),
  );
}

/** True when the post claims mastery of a skill ("I mastered …"). */
function hasMasteryClaim(post: QualityPostInput): boolean {
  return /\b(?:mastered|mastering)\b/i.test(fullText(post));
}

function evidenceStrengthScore(
  ctx: RecruiterPostGenerationContext,
  post: QualityPostInput,
  unsupportedAchievement: boolean,
): number {
  const base: number =
    EVIDENCE_BASE[ctx.evidenceStrength] ?? EVIDENCE_BASE.MISSING ?? 0;
  let score: number = base;
  if (unsupportedAchievement) score -= 30;

  const references = ctx.evidence.filter((entry) => hasText(entry.value));
  if (references.length >= 2) score += 5;

  const postMentionsEvidence = references.some((entry) =>
    sharesContentWord(fullText(post), entry.value ?? ""),
  );
  if (postMentionsEvidence) score += 10;

  return clampScore(score);
}

function practicalExperienceScore(
  ctx: RecruiterPostGenerationContext,
  unsupportedAchievement: boolean,
): number {
  const confirmedPractical = ctx.evidence.filter(
    (entry) =>
      PRACTICAL_FIELDS.has(entry.field) &&
      entry.confidence === "USER_CONFIRMED" &&
      hasText(entry.value),
  );
  const weakPractical = ctx.evidence.filter(
    (entry) =>
      PRACTICAL_FIELDS.has(entry.field) &&
      entry.confidence !== "USER_CONFIRMED" &&
      hasText(entry.value),
  );

  let score: number;
  if (ctx.personalExperience) {
    if (confirmedPractical.length >= 2) score = 100;
    else if (confirmedPractical.length === 1) score = 85;
    else if (ctx.evidenceStrength === "USER_CONFIRMED") score = 35;
    else score = 15;
  } else if (confirmedPractical.length >= 1) {
    score = 70;
  } else if (weakPractical.length >= 1) {
    score = 45;
  } else {
    score = 20;
  }

  if (unsupportedAchievement) score -= 40;
  return clampScore(score);
}

function technicalDepthScore(ctx: RecruiterPostGenerationContext, post: QualityPostInput): number {
  const matched = countTechnicalMatches(post);
  let score = 15;
  score += Math.min(80, matched * 12);

  const confirmedHasTech = ctx.evidence.some(
    (entry) =>
      entry.confidence === "USER_CONFIRMED" &&
      hasText(entry.value) &&
      recruiterQuality.technicalTerms.some((term) => {
        const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`);
        return pattern.test(entry.value!.toLowerCase());
      }),
  );
  if (confirmedHasTech) score += 5;

  return clampScore(score);
}

function problemSolvingScore(
  ctx: RecruiterPostGenerationContext,
  post: QualityPostInput,
): number {
  const confirmedChallenge = ctx.evidence.some(
    (entry) => entry.field === "challenge" && entry.confidence === "USER_CONFIRMED" && hasText(entry.value),
  );
  const confirmedSolution = ctx.evidence.some(
    (entry) => entry.field === "howISolvedIt" && entry.confidence === "USER_CONFIRMED" && hasText(entry.value),
  );

  let score: number;
  if (confirmedChallenge && confirmedSolution) score = 100;
  else if (confirmedChallenge) score = 70;
  else if (hasText(ctx.journal.challenge) && hasText(ctx.journal.howISolvedIt)) score = 60;
  else if (hasText(ctx.journal.challenge)) score = 40;
  else score = 15;

  const postText = fullText(post);
  const challenge = ctx.evidence.find((entry) => entry.field === "challenge");
  const solution = ctx.evidence.find((entry) => entry.field === "howISolvedIt");
  if (challenge?.value && sharesContentWord(postText, challenge.value)) score += 5;
  if (solution?.value && sharesContentWord(postText, solution.value)) score += 5;

  return clampScore(score);
}

function clarityScore(
  ctx: RecruiterPostGenerationContext,
  post: QualityPostInput,
  hashtagWarnings: readonly string[],
): number {
  let score = 70;
  const wc = wordCount(fullText(post));
  if (wc >= 100 && wc <= 260) score += 10;

  const scopeText = `${ctx.topic} ${ctx.title}`.toLowerCase();
  if (sharesContentWord(fullText(post), scopeText)) score += 10;

  if (hasGenericOpener(post)) score -= 15;

  const long = countLongSentences(fullText(post));
  score -= Math.min(10, long * 5);

  const count = post.hashtags.length;
  if (count >= recruiter.hashtags.min && count <= recruiter.hashtags.max) score += 5;
  else if (count > 0) score -= 10;

  score -= hashtagWarnings.length * 3;

  if (hasAnyEmoji(post)) score -= 5;

  return clampScore(score);
}

function authenticityScore(ctx: RecruiterPostGenerationContext, post: QualityPostInput): number {
  let score = 78;
  if (countHonestGrowth(post) > 0) score += 14;
  if (hasFirstPerson(post)) score += 8;
  const avoid = countAvoidWords(post);
  score -= Math.min(60, avoid.length * 15);
  if (POST_TYPE_META[ctx.postType].personalExperience === false && !hasConfirmedEvidence(ctx, PRACTICAL_FIELDS)) {
    if (/\b(?:i|we)\b.{0,40}\b(?:built|implemented|deployed|shipped)\b/i.test(fullText(post))) {
      score -= 25;
    }
  }
  return clampScore(score);
}

function learningGrowthScore(ctx: RecruiterPostGenerationContext, post: QualityPostInput): number {
  const confirmedLearning = hasConfirmedEvidence(ctx, LEARNING_FIELDS);
  const journalLearning = hasText(ctx.journal.whatILearned) || hasText(ctx.journal.keyTakeaway);

  let score: number;
  if (confirmedLearning) score = 85;
  else if (journalLearning) score = 70;
  else if (ctx.evidence.some((entry) => entry.field === "whatILearned" && hasText(entry.value))) score = 55;
  else score = 30;

  const postText = fullText(post);
  const learningEntries = ctx.evidence.filter((entry) => LEARNING_FIELDS.has(entry.field) && hasText(entry.value));
  if (learningEntries.some((entry) => sharesContentWord(postText, entry.value!))) score += 10;

  if (hasText(ctx.journal.tomorrowFocus)) score += 5;

  if (/\bmaster(?:ed|ing)\b/.test(fullText(post).toLowerCase())) score -= 20;

  return clampScore(score);
}

function recruiterRelevanceScore(
  ctx: RecruiterPostGenerationContext,
  post: QualityPostInput,
  techScore: number,
  practicalScore: number,
  problemScore: number,
  growthScore: number,
): number {
  const base = Math.round(Math.max(0, Math.min(100, Number(ctx.recruiterScore) || 0)));
  const contentSignal = Math.round(
    0.35 * techScore + 0.3 * practicalScore + 0.2 * problemScore + 0.15 * growthScore,
  );
  let score = Math.round(0.55 * base + 0.45 * contentSignal);

  const scopeText = `${ctx.topic} ${ctx.title}`.toLowerCase();
  if (sharesContentWord(fullText(post), scopeText)) score += 7;
  else score -= 7;

  const lower = post.hashtags.map((tag) => tag.toLowerCase());
  if (post.hashtags.length > 0 && !lower.includes("#fullstackdevelopment")) score -= 5;

  return clampScore(score);
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/** True when the post uses words the brand forbids (marketing/hype language). */
export function findAvoidWords(post: QualityPostInput): string[] {
  return countAvoidWords(post);
}

/**
 * Builds the total score and publish recommendation from per-dimension scores.
 * The publication recommendation can never be raised above the evidence safety
 * gate: any critical warning forces "do_not_publish".
 */
export function buildQualityResult(
  dimensions: Record<RecruiterQualityDimension, number>,
  flags: {
    readonly hasCriticalWarning: boolean;
  },
): { readonly totalScore: number; readonly publishRecommendation: PublishRecommendation } {
  const total = Math.round(
    RECRUITER_QUALITY_DIMENSIONS.reduce(
      (sum, dimension) =>
        sum + (recruiterQuality.weights[dimension] * (dimensions[dimension] ?? 0)) / 100,
      0,
    ),
  );

  let publishRecommendation: PublishRecommendation;
  if (flags.hasCriticalWarning || total < recruiterQuality.thresholds.needsReview) {
    publishRecommendation = "do_not_publish";
  } else if (total >= recruiterQuality.thresholds.strong) {
    publishRecommendation = "strong";
  } else if (total >= recruiterQuality.thresholds.ready) {
    publishRecommendation = "ready";
  } else {
    publishRecommendation = "needs_review";
  }

  return { totalScore: total, publishRecommendation };
}

// ─── Main evaluation ──────────────────────────────────────────────────────────

/**
 * Evaluates a generated post deterministically.
 *
 * @param post    The current saved post content (opening/body/takeaway/nextStep/hashtags).
 * @param context The recruiter generation context (opportunity + enriched evidence + journal).
 */
export function evaluateRecruiterPost(
  post: QualityPostInput,
  context: RecruiterPostGenerationContext,
): RecruiterQualityResult {
  const missingSection = !hasText(post.opening) || !hasText(post.body) || !hasText(post.takeaway) || !hasText(post.nextStep);

  const claims = findAchievementClaims(post);
  const unsupportedAchievement = claims.some((claim) => {
    const supported = context.evidence.some(
      (entry) =>
        entry.confidence === "USER_CONFIRMED" &&
        hasText(entry.value) &&
        sharesContentWord(claim, entry.value ?? ""),
    );
    return !supported;
  });

  const masteryClaim = hasMasteryClaim(post);
  const avoidWords = findAvoidWords(post);
  const hashtag = validateRecruiterHashtags(post.hashtags, { journey: true });

  // ── Gather warnings (deterministic, pre-authored copy) ─────────────────
  const warnings: string[] = [];
  let hasCriticalWarning = false;

  if (missingSection) {
    hasCriticalWarning = true;
    warnings.push("Critical: the post is missing a required section (opening, body, takeaway, or next step).");
  }
  if (unsupportedAchievement) {
    hasCriticalWarning = true;
    warnings.push(
      "Critical: the post makes a personal achievement claim that is not supported by your confirmed evidence. Edit it to describe learning, or regenerate.",
    );
  }
  if (masteryClaim) {
    warnings.push(
      "The post claims mastery or expertise. Reword it to describe current progress honestly.",
    );
  }
  if (avoidWords.length > 0) {
    warnings.push(
      `Avoid marketing/hype words: ${avoidWords.join(", ")}. Use plain learner language instead.`,
    );
  }
  warnings.push(...hashtag.warnings);
  if (hasGenericOpener(post)) {
    warnings.push("The opening is generic. Lead with the concrete topic or work instead.");
  }
  if (countLongSentences(fullText(post)) > 0) {
    warnings.push("Some sentences are very long. Split them for clarity.");
  }

  // ── Dimension scores ────────────────────────────────────────────────────
  const techDepthScore = technicalDepthScore(context, post);
  const practicalScore = practicalExperienceScore(context, unsupportedAchievement);
  const problemScore = problemSolvingScore(context, post);
  const growthScore = learningGrowthScore(context, post);

  const dimensions = {
    evidenceStrength: evidenceStrengthScore(context, post, unsupportedAchievement),
    practicalExperience: practicalScore,
    technicalDepth: techDepthScore,
    problemSolving: problemScore,
    clarity: clarityScore(context, post, hashtag.warnings),
    authenticity: authenticityScore(context, post),
    learningGrowth: growthScore,
    recruiterRelevance: recruiterRelevanceScore(
      context,
      post,
      techDepthScore,
      practicalScore,
      problemScore,
      growthScore,
    ),
  };

  const { totalScore, publishRecommendation } = buildQualityResult(dimensions, {
    hasCriticalWarning,
  });

  // ── Strengths & improvements (deterministic) ───────────────────────────
  const strengths: string[] = [];
  const improvements: string[] = [];

  if (dimensions.evidenceStrength >= 85)
    strengths.push("Strong user-confirmed evidence backs this post.");
  if (dimensions.practicalExperience >= 85)
    strengths.push("The post shows confirmed practical project work recruiters can understand.");
  if (dimensions.technicalDepth >= 70)
    strengths.push("Concrete technical depth makes this post specific and credible.");
  if (dimensions.problemSolving >= 85)
    strengths.push("A clear problem-to-solution arc supported by your own experience.");
  if (dimensions.learningGrowth >= 75)
    strengths.push("The post shows visible growth and a clear next step.");
  if (dimensions.authenticity >= 80)
    strengths.push("Honest first-person voice — no mastery or hype words.");
  if (dimensions.clarity >= 80) strengths.push("Clear, focused, and easy to scan.");
  if (dimensions.recruiterRelevance >= 80)
    strengths.push("Highly relevant to a recruiter scanning for evidence of real skills.");

  if (dimensions.technicalDepth < 60)
    improvements.push("Make the practical side more concrete: name the tools, how, and what it does.");
  if (dimensions.practicalExperience < 60 && !context.personalExperience)
    improvements.push("Describe how you practiced or applied the concept so the progress is visible.");
  if (dimensions.problemSolving < 60)
    improvements.push("Show the problem and how you worked toward the fix.");
  if (dimensions.learningGrowth < 60)
    improvements.push("Add what you learned and what you are trying next.");
  if (dimensions.clarity < 70)
    improvements.push("Tighten the opening so it names the concrete topic or work.");
  if (dimensions.authenticity < 70)
    improvements.push("Use plain early-learner language; avoid hype or mastery phrasing.");
  if (unsupportedAchievement)
    improvements.push("Edit or regenerate so personal claims match your confirmed evidence.");
  if (hashtag.warnings.length > 0 && post.hashtags.length > 0)
    improvements.push("Adjust hashtags to the 3–5 relevant, on-topic range.");

  return {
    totalScore,
    dimensions,
    strengths,
    improvements,
    warnings,
    hasCriticalWarning,
    publishRecommendation,
  };
}

// ─── Report + approve gate ───────────────────────────────────────────────────

/**
 * Evaluates a generated post stored in the DB against a recruiter context and
 * returns the safe report. Used by the generation adapter to annotate new posts
 * and by the quality service for re-evaluation after edits / at approval.
 */
export function qualityReportForPost(
  post: { readonly opening: string; readonly body: string; readonly takeaway: string; readonly next_step: string; readonly hashtags: readonly string[] },
  context: RecruiterPostGenerationContext,
  evaluatedAt?: string,
): RecruiterQualityReport {
  const result = evaluateRecruiterPost(
    {
      opening: post.opening,
      body: post.body,
      takeaway: post.takeaway,
      nextStep: post.next_step,
      hashtags: post.hashtags,
    },
    context,
  );
  return recruiterQualityReportFromResult(result, evaluatedAt);
}

/**
 * Converts an evaluation into the safe, persistable report shape with a
 * timestamp. No chain-of-thought, no prompts.
 */
export function recruiterQualityReportFromResult(
  result: RecruiterQualityResult,
  evaluatedAt?: string,
): RecruiterQualityReport {
  return {
    score: result.totalScore,
    recommendation: result.publishRecommendation,
    dimensions: result.dimensions,
    strengths: [...result.strengths],
    improvements: [...result.improvements],
    warnings: [...result.warnings],
    evaluatedAt: evaluatedAt ?? new Date().toISOString(),
  };
}

/**
 * Pure approve gate. Non-opportunity posts (no report) are unaffected.
 * `do_not_publish` (any critical warning or score < 55) is always blocked.
 * `needs_review` is allowed — approval then requires explicit UI confirmation.
 */
export function evaluateApproveGate(
  report: RecruiterQualityReport | null | undefined,
):
  | { readonly allowed: true }
  | { readonly allowed: false; readonly code: "QUALITY_GATE_BLOCKED"; readonly message: string } {
  if (!report) return { allowed: true };
  if (report.recommendation === "do_not_publish") {
    const critical =
      report.warnings.find((warning) => warning.startsWith("Critical:")) ??
      "This post is not ready to approve.";
    return {
      allowed: false,
      code: "QUALITY_GATE_BLOCKED",
      message: critical,
    };
  }
  return { allowed: true };
}