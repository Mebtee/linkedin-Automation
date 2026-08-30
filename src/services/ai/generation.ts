import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/utils/errors";
import type { PostFormat, PostGenerationInput } from "@/types/ai";
import type { GeneratedPostRow, CreateGeneratedPostInput } from "@/types/generated-post";
import type { JournalEntry } from "@/types/journal";
import type { CurriculumDayRow } from "@/services/curriculum/dayProgress";
import { getTextGenerationProvider } from "./index";
import { validateGeneratedPostPayload } from "./validation";
import { createContentHash } from "@/services/generated-posts/hashing";
import { createGeneratedPost, checkDuplicatePost } from "@/services/generated-posts";

// ─── Error Codes ─────────────────────────────────────────────────────────────

export type GenerationErrorCode =
  | "GENERATION_UNAUTHORIZED"
  | "CURRICULUM_NOT_FOUND"
  | "JOURNAL_NOT_FOUND"
  | "JOURNAL_NOT_SUBMITTED"
  | "GENERATION_DUPLICATE"
  | "GENERATION_FAILED";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireAuth(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ id: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("Authentication required to generate posts.", {
      code: "GENERATION_UNAUTHORIZED",
    });
  }

  return user;
}

async function loadCurriculumDay(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dayNumber: number,
): Promise<CurriculumDayRow> {
  const { data, error } = await supabase
    .from("curriculum_days")
    .select("*")
    .eq("day_number", dayNumber)
    .single();

  if (error || !data) {
    throw new AppError(
      `Curriculum day ${dayNumber} not found.`,
      { code: "CURRICULUM_NOT_FOUND" },
    );
  }

  return data as CurriculumDayRow;
}

async function loadModule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  moduleId: string,
): Promise<{ module_number: number; title: string }> {
  const { data, error } = await supabase
    .from("modules")
    .select("module_number, title")
    .eq("id", moduleId)
    .single();

  if (error || !data) {
    throw new AppError("Module not found.", { code: "CURRICULUM_NOT_FOUND" });
  }

  return data;
}

async function loadJournalEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  dayNumber: number,
): Promise<JournalEntry> {
  const { data, error } = await supabase
    .from("daily_learning_entries")
    .select("*")
    .eq("profile_id", userId)
    .eq("day_number", dayNumber)
    .single();

  if (error || !data) {
    throw new AppError(
      `No journal entry found for Day ${dayNumber}. Please write a journal entry first.`,
      { code: "JOURNAL_NOT_FOUND" },
    );
  }

  return data as JournalEntry;
}

// Export the loaders so the recruiter opportunity path (Phase 5C) reuses the
// exact same helpers — there is only one pipeline.
export {
  loadCurriculumDay as loadCurriculumDayForRecruiter,
  loadModule as loadModuleForRecruiter,
  loadJournalEntry as loadJournalEntryForRecruiter,
};

// ─── Shared Generation Core (Phase 5C) ───────────────────────────────────────
// The provider-call → validate → hash → duplicate-check → persist core shared
// by the recruiter opportunity path (src/services/recruiter/generation.ts).
// The recruiter path builds a PostGenerationInput and delegates here — there
// is exactly ONE generation pipeline.

export type GeneratePostCoreParams = {
  readonly dayNumber: number;
  readonly journalEntryId: string;
  readonly format: PostFormat;
  readonly input: PostGenerationInput;
  /** Optional link to the content opportunity producing this post (Phase 5C). */
  readonly opportunityId?: string | null;
};

/**
 * Runs the shared generation pipeline for a prepared PostGenerationInput:
 * authenticates, calls the configured AI provider, validates its output,
 * computes the content hash, enforces the existing day/format/hash duplicate
 * protection, and persists a `draft` generated post.
 *
 * Generation never auto-approves or auto-publishes.
 */
export async function generatePostFromPreparedInput(
  params: GeneratePostCoreParams,
): Promise<GeneratedPostRow> {
  const { dayNumber, journalEntryId, format, input, opportunityId } = params;

  const supabase = await createClient();
  const user = await requireAuth(supabase);

  // 1. Call AI provider
  const provider = getTextGenerationProvider();
  let result;
  try {
    result = await provider.generatePost(input);
  } catch (err) {
    throw new AppError(
      `Post generation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      { code: "GENERATION_FAILED", cause: err },
    );
  }

  // 2. Validate provider output
  let validatedPayload;
  try {
    validatedPayload = validateGeneratedPostPayload(result.payload);
  } catch (err) {
    throw new AppError(
      `Provider returned invalid output: ${err instanceof Error ? err.message : "Validation failed"}`,
      { code: "GENERATION_FAILED", cause: err },
    );
  }

  // 3. Calculate content hash
  const contentHash = createContentHash({
    opening: validatedPayload.post.opening,
    body: validatedPayload.post.body,
    takeaway: validatedPayload.post.takeaway,
    nextStep: validatedPayload.post.nextStep,
    hashtags: validatedPayload.post.hashtags,
  });

  // 4. Check for duplicates (existing day/format/content-hash protection)
  const isDuplicate = await checkDuplicatePost(
    user.id,
    dayNumber,
    format,
    contentHash,
  );

  if (isDuplicate) {
    throw new AppError(
      "A generated post with identical content already exists for this day and format.",
      { code: "GENERATION_DUPLICATE" },
    );
  }

  // 5. Persist
  const createInput: CreateGeneratedPostInput = {
    journal_entry_id: journalEntryId,
    day_number: dayNumber,
    format,
    opening: validatedPayload.post.opening,
    body: validatedPayload.post.body,
    takeaway: validatedPayload.post.takeaway,
    next_step: validatedPayload.post.nextStep,
    hashtags: validatedPayload.post.hashtags,
    image_headline: validatedPayload.image.headline,
    image_subheadline: validatedPayload.image.subheadline,
    image_keywords: [...validatedPayload.image.keywords],
    image_visual_concept: validatedPayload.image.visualConcept,
    image_template: validatedPayload.image.template,
    provider: result.metadata.provider,
    model: result.metadata.model,
    tokens_used: result.metadata.tokensUsed ?? null,
    content_hash: contentHash,
    opportunity_id: opportunityId ?? null,
  };

  const savedPost = await createGeneratedPost(createInput);

  return savedPost;
}