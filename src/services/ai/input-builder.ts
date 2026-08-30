import type {
  PostGenerationInput,
  CurriculumContext,
  JournalContext,
  PostFormat,
} from "@/types/ai";
import type { RecruiterPostGenerationContext } from "@/types/content-opportunity";
import type { JournalEntry } from "@/types/journal";
import { content } from "@/config/content";
import { buildRecruiterContentBrief } from "@/services/recruiter/brief";

// ─── Curriculum Day Row (subset needed for input building) ───────────────────

export type CurriculumDayForInput = {
  readonly day_number: number;
  readonly topic: string;
  readonly content: string | null;
  readonly subtopics: string[] | null;
  readonly project_information: string | null;
  readonly assessment_information: string | null;
};

export type ModuleForInput = {
  readonly module_number: number;
  readonly title: string;
};

// ─── Input Builder ───────────────────────────────────────────────────────────

/**
 * Builds a PostGenerationInput from database rows.
 *
 * This is a pure function — no side effects, no database calls.
 * It maps existing DB data into the clean application-level input
 * that the AI provider expects.
 *
 * The AI provider receives:
 *   - curriculum context (topic, module, content, subtopics)
 *   - journal context (all learning fields)
 *   - brand voice (tone, avoid list, style rules)
 *   - post format
 *   - content rules (word count, hashtags, etc.)
 *
 * Null journal fields remain null — they are never invented.
 */
export function buildPostGenerationInput(params: {
  readonly curriculumDay: CurriculumDayForInput;
  readonly module: ModuleForInput;
  readonly journal: JournalEntry;
  readonly format: PostFormat;
  /** Optional recruiter-focused context (Phase 5C). */
  readonly recruiter?: RecruiterPostGenerationContext;
}): PostGenerationInput {
  const { curriculumDay, module, journal, format, recruiter } = params;

  const curriculum: CurriculumContext = {
    dayNumber: curriculumDay.day_number,
    topic: curriculumDay.topic,
    moduleNumber: module.module_number,
    moduleTitle: module.title,
    content: curriculumDay.content ?? "",
    subtopics: curriculumDay.subtopics ?? [],
    projectInformation: curriculumDay.project_information,
    assessmentInformation: curriculumDay.assessment_information,
  };

  const journalContext: JournalContext = {
    whatILearned: journal.what_i_learned,
    whatIPracticed: journal.what_i_practiced,
    whatIBuilt: journal.what_i_built,
    challenge: journal.challenge,
    howISolvedIt: journal.how_i_solved_it,
    keyTakeaway: journal.key_takeaway,
    tomorrowFocus: journal.tomorrow_focus,
    projectName: journal.project_name,
    projectDescription: journal.project_description,
    codeReference: journal.code_reference,
    resourcesUsed: journal.resources_used,
    confidenceLevel: journal.confidence_level,
    additionalNotes: journal.additional_notes,
  };

  return {
    curriculum,
    journal: journalContext,
    brandVoice: content.brandVoice,
    format,
    rules: content.rules,
    ...(recruiter
      ? { recruiter, recruiterBrief: buildRecruiterContentBrief(recruiter) }
      : {}),
  };
}
