import type {
  CourseJournalProposal,
  CurriculumMatchResult,
  ExtractedPdfDocument,
  JournalFieldSource,
  ProposedJournalFields,
} from "@/types/course-material";
import type { PageStructure } from "./extraction";
import type { CurriculumSourceData } from "./matching";

// ─── Journal Auto-Builder ───────────────────────────────────────────────────
// Builds a proposed journal from course material using the EXISTING journal
// field vocabulary (camelCase mirror of UpdateJournalEntryInput).
//
// ANTI-HALLUCINATION CONTRACT:
// - Only information explicitly present in the PDF becomes field content.
// - Personal experience (practice, builds, challenges, solutions, feelings)
//   is NEVER fabricated — those fields stay null and are listed as missing.
// - confidenceLevel is never invented; the user must choose it.
// - Every field carries an evidence entry so the UI can show its origin.

const COURSE_VERB_RE =
  /\b(covers?|covered|explains?|explained|introduces?|introduced|describes?|described|discuss(?:es|ed)?|teaches?|taught|focus(?:es|ed)? on|deals? with|presents?)\b/i;

const PROJECT_HINT_RE =
  /\b(example\s+)?project\b|\bcase study\b|\bbuild(?:ing)? a\b|\bcapstone\b/i;
const CODE_FILE_RE = /\b[a-z][a-z0-9_-]*\.(?:py|js|jsx|ts|tsx|java|c|cpp|cs|rb|go|rs|php|sql|ipynb|html|css)\b/i;

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25 && s.length <= 320);
}

type SupportedStatement = {
  readonly sentence: string;
  readonly pageNumber: number;
};

/**
 * Collects explicit course-content statements ("the course covers…",
 * "this section explains…") with their source pages. These are the ONLY
 * raw materials eligible for the "What I learned" field.
 */
export function collectLearningStatements(
  doc: ExtractedPdfDocument,
  limit = 5,
): readonly SupportedStatement[] {
  const seen = new Set<string>();
  const collected: SupportedStatement[] = [];

  for (const page of doc.pages) {
    for (const sentence of splitSentences(page.text)) {
      if (!COURSE_VERB_RE.test(sentence)) continue;

      // Normalize whitespace and dedupe near-identical statements.
      const key = sentence.toLowerCase().slice(0, 120);
      if (seen.has(key)) continue;
      seen.add(key);

      collected.push({ sentence, pageNumber: page.pageNumber });
      if (collected.length >= limit) return collected;
    }
  }

  return collected;
}

function findCodeFileReferences(
  structures: readonly PageStructure[],
  limit = 3,
): readonly { name: string; pageNumber: number }[] {
  const found: { name: string; pageNumber: number }[] = [];
  const seen = new Set<string>();

  for (const page of structures) {
    for (const line of page.text.split(/\r?\n/)) {
      const match = CODE_FILE_RE.exec(line);
      if (!match) continue;
      const name = match[0];
      if (seen.has(name)) continue;
      seen.add(name);
      found.push({ name, pageNumber: page.pageNumber });
      if (found.length >= limit) return found;
    }
  }
  return found;
}

function containsProjectHint(doc: ExtractedPdfDocument): boolean {
  return doc.pages.some((p) => PROJECT_HINT_RE.test(p.text));
}

// ─── Main Builder ───────────────────────────────────────────────────────────

export function buildJournalFromCourseMaterial(input: {
  readonly doc: ExtractedPdfDocument;
  readonly structures: readonly PageStructure[];
  readonly match: CurriculumMatchResult;
  readonly source: CurriculumSourceData;
  readonly totalDays: number;
}): CourseJournalProposal {
  const { doc, structures, match, source, totalDays } = input;

  const statements = collectLearningStatements(doc);

  // ── What I learned: ONLY explicit course statements ──
  let whatILearned: string | null = null;
  if (statements.length > 0) {
    whatILearned = statements.map((s) => s.sentence).join(" ");
    if (whatILearned.length > 900) {
      whatILearned = `${whatILearned.slice(0, 897)}...`;
    }
  }

  const learnedPages = [
    ...new Set(statements.map((s) => s.pageNumber)),
  ].sort((a, b) => a - b);

  // ── Key takeaway: course-derived summary of the material's scope ──
  const keyTakeaway: string | null =
    statements.length > 0
      ? `Course material focus: ${match.topic}.`
      : null;

  // ── Code references: only actual code-file names present in the PDF ──
  const codeFiles = findCodeFileReferences(structures);
  const codeReference: string | null =
    codeFiles.length > 0
      ? `Example files referenced in the PDF: ${codeFiles.map((f) => f.name).join(", ")}.`
      : null;

  // ── Tomorrow focus: curriculum-derived SUGGESTION, clearly marked ──
  let tomorrowFocus: string | null = null;
  const nextDay =
    match.dayNumber !== null && match.dayNumber < totalDays
      ? source.days.find((d) => d.day_number === match.dayNumber! + 1)
      : undefined;
  if (nextDay) {
    tomorrowFocus = `(Suggested) Continue with Day ${nextDay.day_number}: ${nextDay.topic}`;
  }

  // ── Project hint detection (warning only — never a personal claim) ──
  const projectMentioned = containsProjectHint(doc);

  const journal: ProposedJournalFields = {
    whatILearned,
    whatIPracticed: null,
    whatIBuilt: null,
    challenge: null,
    howISolvedIt: null,
    keyTakeaway,
    tomorrowFocus,
    projectName: null,
    projectDescription: null,
    codeReference,
    resourcesUsed: `Course PDF: ${doc.fileName}`,
    confidenceLevel: null,
    additionalNotes: null,
  };

  // ── Evidence map ──
  const evidence: JournalFieldSource[] = [
    {
      field: "whatILearned",
      sourceType: whatILearned ? "pdf" : "missing",
      pageNumbers: learnedPages,
      confidence: whatILearned ? "SUPPORTED_BY_PDF" : "MISSING",
    },
    { field: "whatIPracticed", sourceType: "missing", pageNumbers: [], confidence: "MISSING" },
    { field: "whatIBuilt", sourceType: "missing", pageNumbers: [], confidence: "MISSING" },
    { field: "challenge", sourceType: "missing", pageNumbers: [], confidence: "MISSING" },
    { field: "howISolvedIt", sourceType: "missing", pageNumbers: [], confidence: "MISSING" },
    {
      field: "keyTakeaway",
      sourceType: keyTakeaway ? "pdf" : "missing",
      pageNumbers: learnedPages,
      confidence: keyTakeaway ? "SUPPORTED_BY_PDF" : "MISSING",
    },
    {
      field: "tomorrowFocus",
      sourceType: tomorrowFocus ? "curriculum" : "missing",
      pageNumbers: [],
      confidence: tomorrowFocus ? "INFERRED_FROM_STRUCTURE" : "MISSING",
    },
    { field: "projectName", sourceType: "missing", pageNumbers: [], confidence: "MISSING" },
    { field: "projectDescription", sourceType: "missing", pageNumbers: [], confidence: "MISSING" },
    {
      field: "codeReference",
      sourceType: codeReference ? "pdf" : "missing",
      pageNumbers: codeFiles.map((f) => f.pageNumber),
      confidence: codeReference ? "SUPPORTED_BY_PDF" : "MISSING",
    },
    {
      field: "resourcesUsed",
      sourceType: "user",
      pageNumbers: [],
      confidence: "USER_CONFIRMED",
    },
    { field: "confidenceLevel", sourceType: "missing", pageNumbers: [], confidence: "MISSING" },
    { field: "additionalNotes", sourceType: "missing", pageNumbers: [], confidence: "MISSING" },
  ];

  // ── Missing fields: everything the user should review or complete ──
  const missingFields: string[] = evidence
    .filter((e) => e.confidence === "MISSING")
    .map((e) => e.field);
  // confidenceLevel is never auto-filled even though the field is "present"
  // as null — it always requires user input before submission.
  if (!missingFields.includes("confidenceLevel")) missingFields.push("confidenceLevel");

  // ── Warnings ──
  const warnings: string[] = [
    "This proposal was generated from course material only. Fields describing your own practice, work, or challenges were intentionally left empty.",
  ];
  if (journal.whatIPracticed === null) {
    warnings.push(
      "The PDF may contain exercises, but it does not confirm that you personally completed them — add your practice manually.",
    );
  }
  if (projectMentioned) {
    warnings.push(
      "The PDF mentions a project, but does not confirm you personally built it — fill in project details yourself if applicable.",
    );
  }
  if (match.confidence === "MEDIUM" || match.confidence === "LOW" || match.confidence === "UNKNOWN") {
    warnings.push(`Curriculum day match confidence is ${match.confidence.toLowerCase()} — please verify the selected day.`);
  }

  return {
    curriculumDay: match.dayNumber ?? 0,
    moduleNumber: match.moduleNumber,
    moduleTitle: match.moduleTitle,
    topic: match.topic,
    matchConfidence: match.confidence,
    journal,
    evidence,
    missingFields,
    warnings,
    candidates: match.candidates,
    rationale: match.rationale,
    builtBy: "deterministic",
  };
}
