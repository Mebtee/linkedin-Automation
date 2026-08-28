// ─── Evidence → Content Opportunity Builder (Phase 5B) ───────────────────────
// Deterministically converts confirmed journal / course-material evidence into
// candidate ContentOpportunity drafts.
//
// Anti-hallucination contract (from Phase 5A, never weakened):
//   - Personal-experience post types (built / solved / debugged / deployed /
//     secured / integrated / decided) are only produced from USER_CONFIRMED
//     personal-field evidence.
//   - Course material alone (unconfirmed) can only produce learning
//     opportunities (TECHNICAL_LESSON, LEARNING_MILESTONE).
//   - "Students will build a REST API" never becomes "I built a REST API."
//
// The builder is pure and deterministic: identical input always produces the
// same drafts in the same order with the same dedup keys.

import { createHash } from "crypto";
import type { JournalFieldSource, EvidenceType } from "@/types/course-material";
import type { ContentGoal, PostType } from "@/types/content-opportunity";
import type {
  ContentOpportunityEvidenceReference,
  ContentOpportunitySourceKind,
  DimensionEvidence,
  OpportunityDimensions,
  OpportunityScoringInput,
  ScoredOpportunity,
} from "@/types/content-opportunity";
import { scoreOpportunities } from "./scoring";
import type { JournalContext } from "@/types/ai";

// ─── Input / Draft Shapes ────────────────────────────────────────────────────

export type OpportunityBuilderInput = {
  readonly profileId: string;
  readonly sourceType: ContentOpportunitySourceKind;
  readonly sourceId: string | null;
  readonly dayNumber: number | null;
  readonly moduleNumber: number | null;
  readonly topic: string;
  readonly moduleTitle: string | null;
  readonly journal: JournalContext;
  /** True when the journal was reviewed/submitted by the user. */
  readonly confirmed: boolean;
  /** Optional per-field evidence originating from a course-material proposal. */
  readonly evidence?: readonly JournalFieldSource[];
  readonly curriculum?: {
    readonly content: string | null;
    readonly subtopics: readonly string[];
    readonly projectInformation: string | null;
    readonly assessmentInformation: string | null;
  } | null;
  readonly recentPostTypes?: readonly PostType[];
  readonly recentTopics?: readonly string[];
};

export type ContentOpportunityDraft = {
  readonly postType: PostType;
  readonly title: string;
  readonly summary: string | null;
  readonly topic: string;
  readonly evidenceStrength: EvidenceType;
  readonly evidenceReferences: readonly ContentOpportunityEvidenceReference[];
  readonly dimensions: OpportunityDimensions;
  readonly skillCodes: readonly string[];
  readonly dedupKey: string;
};

// ─── Field Vocabularies ──────────────────────────────────────────────────────

type JournalStringKey =
  | "whatILearned"
  | "whatIPracticed"
  | "whatIBuilt"
  | "challenge"
  | "howISolvedIt"
  | "keyTakeaway"
  | "tomorrowFocus"
  | "projectName"
  | "projectDescription"
  | "codeReference"
  | "resourcesUsed"
  | "additionalNotes";

const ALL_FIELD_KEYS: readonly JournalStringKey[] = [
  "whatILearned",
  "whatIPracticed",
  "whatIBuilt",
  "challenge",
  "howISolvedIt",
  "keyTakeaway",
  "tomorrowFocus",
  "projectName",
  "projectDescription",
  "codeReference",
  "resourcesUsed",
  "additionalNotes",
];

/** Fields that describe first-person engineering work when present. */
const PERSONAL_FIELDS: ReadonlySet<string> = new Set([
  "whatIPracticed",
  "whatIBuilt",
  "challenge",
  "howISolvedIt",
  "projectName",
  "projectDescription",
  "codeReference",
  "additionalNotes",
]);

const LEARNING_FIELDS: ReadonlySet<string> = new Set([
  "whatILearned",
  "keyTakeaway",
  "whatIPracticed",
  "codeReference",
  "tomorrowFocus",
]);

// ─── Keyword Signals ─────────────────────────────────────────────────────────

const SECURITY_RE =
  /\b(rls|row.level security|policy|permission|denied|authorization?|authentication|oauth|csrf|token|secret|\.env|environment variable|encrypt|hash(ed)? password|sql injection|xss|security|vulnerab|rate limit)\b/i;
const DEPLOYMENT_RE =
  /\b(deploy|production|vercel|netlify|ci\/cd|github actions|environment (variable|config)|hosting|ssl|domain|dns|middleware|build error|standalone|docker)\b/i;
const DATABASE_RE =
  /\b(postgres|supabase|schema|migration|index|foreign key|primary key|join|query|database|row.level security|trigger|constraint|normalization|sql)\b/i;
const API_RE =
  /\b(api|api key|oauth|http|rest(ful)? api|endpoint|request|response|json|webhook|integration|axios|fetch|client.server)\b/i;
const AI_RE =
  /\b(gemini|llm|large language model|ai|prompt|model|provider|fallback|json schema|generation|embedding|structured output)\b/i;
const DEBUG_RE =
  /\b(bug|error|failed|failure|crash|exception|stack trace|debug|root cause|permission denied|not found|500|404)\b/i;
const DECISION_RE =
  /\b(chose|choice|decided|decision|because|trade.?off|alternative|compared |architecture|pattern|approach)\b/i;
const CAREER_RE =
  /\b(career|job|interview|resume|cv|portfolio|open to work|junior|intern|transition|job search|hiring)\b/i;

/** REQUIRED first-person signal for work-type opportunities. */
const EXECUTION_RE =
  /\b(I |my |we |our |the app|the project|the api|the site|the database|the server)\b|\bfixed\b|\bfixed a\b|\bsolved\b|\bbuilt\b|\bimplemented\b|\bintegrated\b|\bdeployed\b/i;

// ─── Skill Detection ─────────────────────────────────────────────────────────

const SKILL_DEFINITIONS: readonly { code: string; re: RegExp }[] = [
  { code: "nextjs", re: /\bnext\.js\b/i },
  { code: "react", re: /\breact\b/i },
  { code: "typescript", re: /\btypescript\b/i },
  { code: "javascript", re: /\bjavascript\b/i },
  { code: "supabase", re: /\bsupabase\b/i },
  { code: "postgresql", re: /\bpostgres(ql)?\b/i },
  { code: "sql", re: /\bsql\b/i },
  { code: "git", re: /\bgit\b/i },
  { code: "python", re: /\bpython\b/i },
  { code: "nodejs", re: /\bnode\.js\b/i },
  { code: "oauth", re: /\boauth\b/i },
  { code: "auth", re: /\bauth(entication|orization)?\b/i },
  { code: "vercel", re: /\bvercel\b/i },
  { code: "docker", re: /\bdocker\b/i },
  { code: "html", re: /\bhtml\b/i },
  { code: "css", re: /\bcss\b/i },
  { code: "rest", re: /\brest(ful)? api\b/i },
  { code: "ai", re: /\bgemini\b|\bllm\b/i },
  { code: "security", re: SECURITY_RE },
  { code: "testing", re: /\b(tests?|testing|vitest|jest|tdd)\b/i },
  { code: "rls", re: /\brls\b/i },
];

// ─── Text Helpers ────────────────────────────────────────────────────────────

function text(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length >= 4 ? normalized : null;
}

function clip(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function slug(value: string): string {
  const s = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.slice(0, 48) || "untitled";
}

function makeDedupKey(
  input: OpportunityBuilderInput,
  postType: PostType,
  title: string,
): string {
  const raw = [input.sourceType, input.dayNumber ?? "na", postType, slug(title)].join("::");
  return createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 24);
}

// ─── Evidence Helpers ────────────────────────────────────────────────────────

const CONFIDENCE_RANK: Record<EvidenceType, number> = {
  USER_CONFIRMED: 4,
  SUPPORTED_BY_PDF: 3,
  INFERRED_FROM_STRUCTURE: 2,
  MISSING: 1,
};

function strongest(confs: readonly EvidenceType[]): EvidenceType {
  let best: EvidenceType = "MISSING";
  for (const c of confs) {
    if (CONFIDENCE_RANK[c] > CONFIDENCE_RANK[best]) best = c;
  }
  return best;
}

function proposalConfidence(input: OpportunityBuilderInput, key: string): EvidenceType | null {
  const source = input.evidence?.find((e) => e.field === key);
  if (!source || source.confidence === "MISSING") return null;
  return source.confidence;
}

function pagesFor(input: OpportunityBuilderInput, key: string): readonly number[] {
  return input.evidence?.find((e) => e.field === key)?.pageNumbers ?? [];
}

function fieldConfidence(
  input: OpportunityBuilderInput,
  key: JournalStringKey,
  value: string | null,
): EvidenceType {
  if (!value) return "MISSING";
  const sourceConf = proposalConfidence(input, key);

  if (PERSONAL_FIELDS.has(key)) {
    if (input.confirmed) return "USER_CONFIRMED";
    return sourceConf ?? "INFERRED_FROM_STRUCTURE";
  }

  if (input.confirmed) return "USER_CONFIRMED";
  return sourceConf ?? "INFERRED_FROM_STRUCTURE";
}

type FieldEntry = {
  readonly key: string;
  readonly value: string;
  readonly confidence: EvidenceType;
};

function fieldEntries(input: OpportunityBuilderInput): readonly FieldEntry[] {
  const entries: FieldEntry[] = [];
  for (const key of ALL_FIELD_KEYS) {
    const value = text(input.journal[key]);
    if (!value) continue;
    entries.push({ key, value, confidence: fieldConfidence(input, key, value) });
  }
  return entries;
}

// ─── Dimension Building ──────────────────────────────────────────────────────

function dim(present: boolean, confidence: EvidenceType): DimensionEvidence {
  return { present, confidence };
}

function hasKeyword(fields: readonly FieldEntry[], re: RegExp): boolean {
  return fields.some((f) => re.test(f.value));
}

function confidenceOfMatched(
  fields: readonly FieldEntry[],
  re: RegExp,
): EvidenceType {
  const matched = fields.filter((f) => re.test(f.value));
  return strongest(matched.map((f) => f.confidence));
}

function buildDimensions(
  fields: readonly FieldEntry[],
  evidenceStrength: EvidenceType,
): OpportunityDimensions {
  const presentKeys = new Set(fields.map((f) => f.key));
  const keysAmong = (keys: readonly string[]): boolean =>
    keys.some((k) => presentKeys.has(k));

  const implementationKeys = ["whatIBuilt", "projectName", "projectDescription"];
  const problemKeys = ["challenge", "howISolvedIt"];
  const learningKeys = ["whatILearned", "keyTakeaway", "whatIPracticed", "codeReference", "tomorrowFocus"];

  const confOf = (keys: readonly string[]): EvidenceType =>
    strongest(fields.filter((f) => keys.includes(f.key)).map((f) => f.confidence));

  return {
    realImplementationEvidence: dim(
      keysAmong(implementationKeys),
      confOf(implementationKeys),
    ),
    problemSolvingEvidence: dim(
      presentKeys.has("challenge") && presentKeys.has("howISolvedIt"),
      confOf(problemKeys),
    ),
    technicalDepth: dim(keysAmong(learningKeys), confOf(learningKeys)),
    productionDeploymentRelevance: dim(
      hasKeyword(fields, DEPLOYMENT_RE),
      confidenceOfMatched(fields, DEPLOYMENT_RE),
    ),
    securityEngineeringQuality: dim(
      hasKeyword(fields, SECURITY_RE),
      confidenceOfMatched(fields, SECURITY_RE),
    ),
    multipleSkills: dim(fields.length > 0, evidenceStrength),
    communicationTeachingValue: dim(
      presentKeys.has("whatILearned") || presentKeys.has("keyTakeaway"),
      confOf(["whatILearned", "keyTakeaway"]),
    ),
    uniqueness: dim(true, "USER_CONFIRMED"),
  };
}

// ─── Draft Factory ───────────────────────────────────────────────────────────

function createDraft(
  input: OpportunityBuilderInput,
  fields: readonly FieldEntry[],
  postType: PostType,
  title: string,
  summary: string | null,
): ContentOpportunityDraft {
  const references: ContentOpportunityEvidenceReference[] = fields
    .filter((f) => f.confidence !== "MISSING")
    .map((f) => ({
      field: f.key,
      pageNumbers: pagesFor(input, f.key),
      confidence: f.confidence,
    }));

  const evidenceStrength = strongest(references.map((r) => r.confidence));

  return {
    postType,
    title,
    summary,
    topic: input.topic || title,
    evidenceStrength,
    evidenceReferences: references,
    dimensions: buildDimensions(fields, evidenceStrength),
    skillCodes: detectSkills(input),
    dedupKey: makeDedupKey(input, postType, title),
  };
}

function detectSkills(input: OpportunityBuilderInput): readonly string[] {
  const corpus = [
    input.topic,
    input.moduleTitle,
    ...ALL_FIELD_KEYS.map((k) => input.journal[k] ?? ""),
    ...(input.curriculum?.subtopics ?? []),
    input.curriculum?.content ?? "",
  ]
    .join("\n")
    .toLowerCase();

  return SKILL_DEFINITIONS.filter((s) => s.re.test(corpus)).map((s) => s.code);
}

// ─── Emitters (one per post type) ───────────────────────────────────────────

function buildProjectShowcase(
  input: OpportunityBuilderInput,
  entries: readonly FieldEntry[],
): ContentOpportunityDraft | null {
  const fields = entries.filter((e) =>
    ["whatIBuilt", "projectName", "projectDescription"].includes(e.key),
  );
  if (fields.length === 0) return null;
  if (strongest(fields.map((f) => f.confidence)) !== "USER_CONFIRMED") return null;

  const projectName = text(input.journal.projectName);
  const built = text(input.journal.whatIBuilt);
  const description = text(input.journal.projectDescription);

  const title = projectName
    ? `Building ${projectName}`
    : `Project: ${clip(built ?? description ?? "what I built", 56)}`;
  const summary = [description, built].filter(Boolean).join("\n").slice(0, 320) || null;

  return createDraft(input, fields, "PROJECT_SHOWCASE", title, summary);
}

function buildDebuggingStory(
  input: OpportunityBuilderInput,
  entries: readonly FieldEntry[],
): ContentOpportunityDraft | null {
  const challenge = entries.find((e) => e.key === "challenge");
  const solved = entries.find((e) => e.key === "howISolvedIt");
  if (!challenge || !solved) return null;
  if (strongest([challenge.confidence, solved.confidence]) !== "USER_CONFIRMED") return null;
  if (!DEBUG_RE.test(challenge.value)) return null;

  return createDraft(
    input,
    [challenge, solved],
    "DEBUGGING_STORY",
    `Debugging: ${clip(challenge.value, 64)}`,
    `Symptom: ${clip(challenge.value, 200)} Fix: ${clip(solved.value, 200)}`,
  );
}

function buildProblemSolution(
  input: OpportunityBuilderInput,
  entries: readonly FieldEntry[],
): ContentOpportunityDraft | null {
  const challenge = entries.find((e) => e.key === "challenge");
  const solved = entries.find((e) => e.key === "howISolvedIt");
  if (!challenge || !solved) return null;
  if (strongest([challenge.confidence, solved.confidence]) !== "USER_CONFIRMED") return null;
  if (DEBUG_RE.test(challenge.value)) return null;

  return createDraft(
    input,
    [challenge, solved],
    "PROBLEM_SOLUTION",
    `Solving: ${clip(challenge.value, 64)}`,
    `Problem: ${clip(challenge.value, 200)} Solution: ${clip(solved.value, 200)}`,
  );
}

function buildWorkOpportunity(
  input: OpportunityBuilderInput,
  entries: readonly FieldEntry[],
  postType: PostType,
  signalRe: RegExp,
  label: string,
): ContentOpportunityDraft | null {
  const matched = entries.filter((e) => signalRe.test(e.value));
  if (matched.length === 0) return null;

  const personalMatch = matched.find((e) => PERSONAL_FIELDS.has(e.key));
  if (!personalMatch) return null;
  if (strongest(matched.map((e) => e.confidence)) !== "USER_CONFIRMED") return null;
  if (!EXECUTION_RE.test(matched.map((e) => e.value).join(" "))) return null;

  const anchor = personalMatch;
  const title = `${label}: ${clip(anchor.value, 64)}`;
  const summary = matched
    .slice(0, 3)
    .map((e) => e.value)
    .join("\n")
    .slice(0, 320) || null;

  return createDraft(input, matched, postType, title, summary);
}

function buildEngineeringDecision(
  input: OpportunityBuilderInput,
  entries: readonly FieldEntry[],
): ContentOpportunityDraft | null {
  const matched = entries.filter((e) => DECISION_RE.test(e.value));
  if (matched.length === 0) return null;

  const personalMatch = matched.find((e) => PERSONAL_FIELDS.has(e.key));
  if (!personalMatch) return null;
  if (strongest(matched.map((e) => e.confidence)) !== "USER_CONFIRMED") return null;

  return createDraft(
    input,
    [...matched].sort((a, b) => a.key.localeCompare(b.key)),
    "ENGINEERING_DECISION",
    `Engineering decision: ${clip(personalMatch.value, 64)}`,
    matched
      .slice(0, 3)
      .map((e) => e.value)
      .join("\n")
      .slice(0, 320) || null,
  );
}

function buildTechnicalLesson(
  input: OpportunityBuilderInput,
  entries: readonly FieldEntry[],
): ContentOpportunityDraft | null {
  const fields = entries.filter((e) => LEARNING_FIELDS.has(e.key));
  if (fields.length === 0) return null;

  const anchor =
    entries.find((e) => e.key === "whatILearned") ??
    entries.find((e) => e.key === "keyTakeaway") ??
    fields[0]!;

  const topic = input.topic.trim();
  const title =
    topic && topic.length <= 72
      ? `Understanding ${topic}`
      : `What I learned: ${clip(anchor.value, 56)}`;
  const summary = fields
    .map((e) => e.value)
    .join("\n")
    .slice(0, 320) || null;

  return createDraft(input, fields, "TECHNICAL_LESSON", title, summary);
}

function buildLearningMilestone(
  input: OpportunityBuilderInput,
  entries: readonly FieldEntry[],
): ContentOpportunityDraft | null {
  const anchor =
    entries.find((e) => e.key === "keyTakeaway") ??
    entries.find((e) => e.key === "whatILearned");
  if (!anchor) return null;
  if (anchor.confidence === "MISSING" || anchor.confidence === "INFERRED_FROM_STRUCTURE") {
    return null;
  }

  return createDraft(
    input,
    [anchor],
    "LEARNING_MILESTONE",
    `Milestone: ${clip(anchor.value, 64)}`,
    entrySummary(anchor),
  );
}

function entrySummary(anchor: FieldEntry): string | null {
  return clip(anchor.value, 200) || null;
}

function buildCareerProgress(
  input: OpportunityBuilderInput,
  entries: readonly FieldEntry[],
): ContentOpportunityDraft | null {
  const matched = entries.filter((e) => CAREER_RE.test(e.value));
  if (matched.length === 0) return null;

  const personalMatch = matched.find((e) => e.key === "additionalNotes") ?? matched[0];
  if (!personalMatch || !PERSONAL_FIELDS.has(personalMatch.key)) return null;
  if (strongest(matched.map((e) => e.confidence)) !== "USER_CONFIRMED") return null;

  return createDraft(
    input,
    matched,
    "CAREER_PROGRESS",
    `Career: ${clip(personalMatch.value, 64)}`,
    entrySummary(personalMatch),
  );
}

// ─── Dedup ───────────────────────────────────────────────────────────────────

function uniqueDrafts(drafts: readonly ContentOpportunityDraft[]): ContentOpportunityDraft[] {
  const seenDedup = new Set<string>();
  const seenFields = new Set<string>();
  const out: ContentOpportunityDraft[] = [];

  for (const draft of drafts) {
    if (seenDedup.has(draft.dedupKey)) continue;
    seenDedup.add(draft.dedupKey);

    // Collapse nearly identical opportunities raised from the exact same
    // evidence fields (e.g. SECURITY_LESSON + DATABASE_ENGINEERING matched
    // from one "fixed an RLS leak" entry). Keep the earliest (highest
    // priority) emitter's result.
    const fieldsKey = [
      draft.evidenceReferences.map((r) => r.field).sort().join("+"),
      draft.evidenceStrength,
    ].join("|");
    if (seenFields.has(fieldsKey)) continue;
    seenFields.add(fieldsKey);

    out.push(draft);
  }
  return out;
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

/**
 * Builds candidate content opportunities from journal/course-material evidence.
 * Deterministic: same input → same drafts, same order, same dedup keys.
 */
export function buildContentOpportunities(
  input: OpportunityBuilderInput,
): readonly ContentOpportunityDraft[] {
  const entries = fieldEntries(input);
  if (entries.length === 0) return [];

  const drafts: ContentOpportunityDraft[] = [];
  const push = (draft: ContentOpportunityDraft | null) => {
    if (draft) drafts.push(draft);
  };

  push(buildProjectShowcase(input, entries));
  push(buildDebuggingStory(input, entries));
  push(buildProblemSolution(input, entries));
  push(buildWorkOpportunity(input, entries, "SECURITY_LESSON", SECURITY_RE, "Security lesson"));
  push(buildWorkOpportunity(input, entries, "DEPLOYMENT_STORY", DEPLOYMENT_RE, "Deployment"));
  push(buildWorkOpportunity(input, entries, "API_INTEGRATION", API_RE, "API integration"));
  push(buildWorkOpportunity(input, entries, "DATABASE_ENGINEERING", DATABASE_RE, "Database"));
  push(buildWorkOpportunity(input, entries, "AI_ENGINEERING", AI_RE, "AI engineering"));
  push(buildEngineeringDecision(input, entries));
  push(buildTechnicalLesson(input, entries));
  push(buildLearningMilestone(input, entries));
  push(buildCareerProgress(input, entries));

  return uniqueDrafts(drafts);
}

// ─── Scoring Integration ─────────────────────────────────────────────────────

export function draftToOpportunityInput(
  draft: ContentOpportunityDraft,
  input: OpportunityBuilderInput,
): OpportunityScoringInput {
  return {
    id: draft.dedupKey,
    postType: draft.postType,
    topic: draft.topic,
    summary: draft.summary ?? "",
    evidenceStrength: draft.evidenceStrength,
    dimensions: draft.dimensions,
    skillCodes: draft.skillCodes,
    recentPostTypes: [
      ...new Set(input.recentPostTypes ?? []),
    ],
    recentTopics: [...new Set(input.recentTopics ?? [])],
  };
}

/**
 * Scores drafts with the existing Phase 5A deterministic scorer and keeps the
 * drafts aligned with their scores. Also returns the semi-ordered RECRUITER
 * dimensions the scorer evaluated (direct reuse — not re-implemented).
 */
export function scoreDrafts(
  drafts: readonly ContentOpportunityDraft[],
  input: OpportunityBuilderInput,
  options: { readonly goal?: ContentGoal } = {},
): ScoredOpportunity[] {
  return scoreOpportunities(
    drafts.map((draft) => draftToOpportunityInput(draft, input)),
    options,
  );
}