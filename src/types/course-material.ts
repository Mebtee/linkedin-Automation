// ─── Course Materials — Domain Types ────────────────────────────────────────
// Phase 3I — course PDF ingestion → journal proposal.
//
// The evidence model is the core anti-hallucination contract:
// only SUPPORTED_BY_PDF and USER_CONFIRMED information may ever be
// represented as personal experience. INFERRED_FROM_STRUCTURE may guide
// topic/day selection but must never become personal achievement.

export type EvidenceType =
  | "SUPPORTED_BY_PDF"
  | "INFERRED_FROM_STRUCTURE"
  | "MISSING"
  | "USER_CONFIRMED";

/** Where a proposed journal field's value came from. */
export type JournalFieldSourceType = "pdf" | "curriculum" | "user" | "ai" | "missing";

export type JournalFieldSource = {
  readonly field: string;
  readonly sourceType: JournalFieldSourceType;
  /** 1-based page numbers in the uploaded PDF that support the value. */
  readonly pageNumbers: readonly number[];
  readonly confidence: EvidenceType;
};

// ─── PDF Extraction ─────────────────────────────────────────────────────────

export type ExtractedPdfPage = {
  readonly pageNumber: number;
  readonly text: string;
};

export type ExtractedPdfDocument = {
  readonly fileName: string;
  readonly pageCount: number;
  readonly pages: readonly ExtractedPdfPage[];
};

// ─── Curriculum Matching ────────────────────────────────────────────────────

export type MatchConfidence = "EXACT" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export type CurriculumDayCandidate = {
  readonly dayNumber: number;
  readonly topic: string;
  readonly moduleNumber: number;
  readonly moduleTitle: string;
  readonly score: number;
};

export type CurriculumMatchResult = {
  /** null when no day is selected with sufficient confidence. */
  readonly dayNumber: number | null;
  readonly confidence: MatchConfidence;
  readonly topic: string;
  readonly moduleNumber: number | null;
  readonly moduleTitle: string | null;
  /** Explicit structural evidence found in the document ("Day N", "Module N"). */
  readonly explicitDayNumber: number | null;
  readonly explicitModuleNumber: number | null;
  /** Ranked candidates for user selection when confidence is LOW/UNKNOWN or ambiguous. */
  readonly candidates: readonly CurriculumDayCandidate[];
  /** Human-readable explanation of how the match was derived. */
  readonly rationale: string[];
};

// ─── Journal Proposal ───────────────────────────────────────────────────────

/**
 * A proposed journal using the EXISTING journal field names (camelCase,
 * mirroring `UpdateJournalEntryInput`). Nullable fields stay null when the
 * PDF does not support them — never fabricated.
 */
export type ProposedJournalFields = {
  whatILearned: string | null;
  whatIPracticed: string | null;
  whatIBuilt: string | null;
  challenge: string | null;
  howISolvedIt: string | null;
  keyTakeaway: string | null;
  tomorrowFocus: string | null;
  projectName: string | null;
  projectDescription: string | null;
  codeReference: string | null;
  resourcesUsed: string | null;
  /** Never invented — the user must choose a level before submission. */
  confidenceLevel: number | null;
  additionalNotes: string | null;
};

export type CourseJournalProposal = {
  readonly curriculumDay: number;
  readonly moduleNumber: number | null;
  readonly moduleTitle: string | null;
  readonly topic: string;
  readonly matchConfidence: MatchConfidence;
  readonly journal: ProposedJournalFields;
  readonly evidence: readonly JournalFieldSource[];
  readonly missingFields: readonly string[];
  readonly warnings: readonly string[];
  /** Ranked curriculum-day candidates for user confirmation. */
  readonly candidates: readonly CurriculumDayCandidate[];
  /** Human-readable explanation of how the day was detected. */
  readonly rationale: readonly string[];
  /** How the proposal text was produced: deterministic parser or AI-enhanced. */
  readonly builtBy: "deterministic" | "ai";
  /** Whether the day was matched via an explicit "Day N" reference in the PDF. */
  readonly explicitDayMatch: boolean;
};

// ─── Persistence Rows ───────────────────────────────────────────────────────

export type CourseMaterialStatus = "pending" | "processing" | "completed" | "failed";

/** Processing stage shown in the UI during upload/processing. */
export type ProcessingStage =
  | "uploading"
  | "validating"
  | "extracting"
  | "matching"
  | "building"
  | "enhancing"
  | "ready"
  | "needs_review"
  | "failed";

/** A detected day section within a multi-day PDF. */
export type MultiDaySection = {
  readonly dayNumber: number;
  readonly startPage: number;
  readonly endPage: number;
  readonly confidence: MatchConfidence;
};

export type CourseMaterialRow = {
  id: string;
  profile_id: string;
  file_name: string;
  storage_path: string;
  page_count: number;
  processing_status: CourseMaterialStatus;
  error_code: string | null;
  journal_proposal: CourseJournalProposal | null;
  content_hash: string | null;
  multi_day_sections: MultiDaySection[] | null;
  created_at: string;
  updated_at: string;
};

export type CourseMaterialPageRow = {
  id: string;
  course_material_id: string;
  page_number: number;
  extracted_text: string;
  created_at: string;
};
