import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/utils/errors";
import type {
  GeneratedPostRow,
  GeneratedPostStatus,
  CreateGeneratedPostInput,
  UpdateGeneratedPostInput,
} from "@/types/generated-post";
import {
  validateDayNumber,
  validateCreateInput,
  validateUpdateInput,
  validateStatusTransition,
  validateGeneratedPostStatus,
} from "./validation";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireAuth(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ id: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("Authentication required.", { code: "AUTH_REQUIRED" });
  }

  return user;
}

async function loadOwnPost(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  postId: string,
): Promise<GeneratedPostRow> {
  const { data, error } = await supabase
    .from("generated_posts")
    .select("*")
    .eq("id", postId)
    .eq("profile_id", userId)
    .single();

  if (error || !data) {
    throw new AppError("Generated post not found.", {
      code: "POST_NOT_FOUND",
    });
  }

  return data as GeneratedPostRow;
}

async function requireCurriculumDay(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dayNumber: number,
): Promise<void> {
  const { count, error } = await supabase
    .from("curriculum_days")
    .select("day_number", { count: "exact", head: true })
    .eq("day_number", dayNumber);

  if (error) {
    throw new AppError("Failed to verify curriculum day.", {
      code: "DATABASE_ERROR",
    });
  }

  if (count === 0) {
    throw new AppError(
      `Curriculum day ${dayNumber} does not exist. Must be between 1 and 105.`,
      { code: "CURRICULUM_DAY_NOT_FOUND" },
    );
  }
}

async function requireJournalEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  journalEntryId: string,
  dayNumber: number,
): Promise<void> {
  const { data, error } = await supabase
    .from("daily_learning_entries")
    .select("id, day_number")
    .eq("id", journalEntryId)
    .eq("profile_id", userId)
    .single();

  if (error || !data) {
    throw new AppError("Journal entry not found.", {
      code: "JOURNAL_NOT_FOUND",
    });
  }

  if (data.day_number !== dayNumber) {
    throw new AppError(
      `Journal entry day mismatch: entry is for day ${data.day_number}, but requested day is ${dayNumber}.`,
      { code: "VALIDATION_ERROR" },
    );
  }
}

// ─── Service Functions ───────────────────────────────────────────────────────

export async function createGeneratedPost(
  input: CreateGeneratedPostInput,
): Promise<GeneratedPostRow> {
  const supabase = await createClient();
  const user = await requireAuth(supabase);

  const validated = validateCreateInput(input);
  const dayNumber = validateDayNumber(validated.day_number);

  await requireCurriculumDay(supabase, dayNumber);
  await requireJournalEntry(supabase, user.id, validated.journal_entry_id, dayNumber);

  const { data, error } = await supabase
    .from("generated_posts")
    .insert({
      profile_id: user.id,
      journal_entry_id: validated.journal_entry_id,
      day_number: dayNumber,
      status: "draft",
      format: validated.format,
      opening: validated.opening,
      body: validated.body,
      takeaway: validated.takeaway,
      next_step: validated.next_step,
      hashtags: validated.hashtags,
      image_headline: validated.image_headline ?? null,
      image_subheadline: validated.image_subheadline ?? null,
      image_keywords: validated.image_keywords ? [...validated.image_keywords] : null,
      image_visual_concept: validated.image_visual_concept ?? null,
      image_template: validated.image_template ?? null,
      provider: validated.provider,
      model: validated.model,
      tokens_used: validated.tokens_used ?? null,
      content_hash: validated.content_hash,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new AppError(
        "A generated post with identical content already exists for this day and format.",
        { code: "DUPLICATE_POST" },
      );
    }
    throw new AppError("Failed to create generated post.", {
      code: "DATABASE_ERROR",
      cause: error,
    });
  }

  return data as GeneratedPostRow;
}

export async function getGeneratedPost(
  postId: string,
): Promise<GeneratedPostRow | null> {
  const supabase = await createClient();

  let userId: string;
  try {
    const user = await requireAuth(supabase);
    userId = user.id;
  } catch {
    return null;
  }

  const { data, error } = await supabase
    .from("generated_posts")
    .select("*")
    .eq("id", postId)
    .eq("profile_id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as GeneratedPostRow;
}

export async function getGeneratedPostsForDay(
  dayNumber: number,
): Promise<GeneratedPostRow[]> {
  const supabase = await createClient();

  let userId: string;
  try {
    const user = await requireAuth(supabase);
    userId = user.id;
  } catch {
    return [];
  }

  const validatedDay = validateDayNumber(dayNumber);

  const { data, error } = await supabase
    .from("generated_posts")
    .select("*")
    .eq("profile_id", userId)
    .eq("day_number", validatedDay)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError("Failed to fetch generated posts.", {
      code: "DATABASE_ERROR",
      cause: error,
    });
  }

  return (data ?? []) as GeneratedPostRow[];
}

export async function getGeneratedPostHistory(): Promise<GeneratedPostRow[]> {
  const supabase = await createClient();

  let userId: string;
  try {
    const user = await requireAuth(supabase);
    userId = user.id;
  } catch {
    return [];
  }

  const { data, error } = await supabase
    .from("generated_posts")
    .select("*")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError("Failed to fetch generated post history.", {
      code: "DATABASE_ERROR",
      cause: error,
    });
  }

  return (data ?? []) as GeneratedPostRow[];
}

export async function updateGeneratedPost(
  postId: string,
  input: UpdateGeneratedPostInput,
): Promise<GeneratedPostRow> {
  const supabase = await createClient();
  const user = await requireAuth(supabase);

  await loadOwnPost(supabase, user.id, postId);

  const validated = validateUpdateInput(input);

  // Only update fields that are present in the input
  const fieldsToUpdate: Record<string, unknown> = {};
  if (validated.status !== undefined) fieldsToUpdate.status = validated.status;
  if (validated.opening !== undefined) fieldsToUpdate.opening = validated.opening;
  if (validated.body !== undefined) fieldsToUpdate.body = validated.body;
  if (validated.takeaway !== undefined) fieldsToUpdate.takeaway = validated.takeaway;
  if (validated.next_step !== undefined) fieldsToUpdate.next_step = validated.next_step;
  if (validated.hashtags !== undefined) fieldsToUpdate.hashtags = [...validated.hashtags];
  if (validated.image_headline !== undefined) fieldsToUpdate.image_headline = validated.image_headline;
  if (validated.image_subheadline !== undefined) fieldsToUpdate.image_subheadline = validated.image_subheadline;
  if (validated.image_keywords !== undefined) fieldsToUpdate.image_keywords = validated.image_keywords ? [...validated.image_keywords] : null;
  if (validated.image_visual_concept !== undefined) fieldsToUpdate.image_visual_concept = validated.image_visual_concept;
  if (validated.image_template !== undefined) fieldsToUpdate.image_template = validated.image_template;
  if (validated.content_hash !== undefined) fieldsToUpdate.content_hash = validated.content_hash;

  if (Object.keys(fieldsToUpdate).length === 0) {
    return await loadOwnPost(supabase, user.id, postId);
  }

  const { data, error } = await supabase
    .from("generated_posts")
    .update(fieldsToUpdate)
    .eq("id", postId)
    .eq("profile_id", user.id)
    .select()
    .single();

  if (error) {
    throw new AppError("Failed to update generated post.", {
      code: "DATABASE_ERROR",
      cause: error,
    });
  }

  return data as GeneratedPostRow;
}

export async function changeGeneratedPostStatus(
  postId: string,
  newStatus: GeneratedPostStatus,
): Promise<GeneratedPostRow> {
  const supabase = await createClient();
  const user = await requireAuth(supabase);

  const existing = await loadOwnPost(supabase, user.id, postId);
  const validatedStatus = validateGeneratedPostStatus(newStatus);

  validateStatusTransition(existing.status, validatedStatus);

  const { data, error } = await supabase
    .from("generated_posts")
    .update({ status: validatedStatus })
    .eq("id", postId)
    .eq("profile_id", user.id)
    .select()
    .single();

  if (error) {
    throw new AppError("Failed to update generated post status.", {
      code: "DATABASE_ERROR",
      cause: error,
    });
  }

  return data as GeneratedPostRow;
}

export async function deleteGeneratedPost(
  postId: string,
): Promise<void> {
  const supabase = await createClient();
  const user = await requireAuth(supabase);

  const existing = await loadOwnPost(supabase, user.id, postId);

  // Only draft and failed posts can be deleted
  if (existing.status === "published") {
    throw new AppError("Cannot delete a published post.", {
      code: "INVALID_STATUS",
    });
  }

  const { error } = await supabase
    .from("generated_posts")
    .delete()
    .eq("id", postId)
    .eq("profile_id", user.id);

  if (error) {
    throw new AppError("Failed to delete generated post.", {
      code: "DATABASE_ERROR",
      cause: error,
    });
  }
}

export async function checkDuplicatePost(
  userId: string,
  dayNumber: number,
  format: string,
  contentHash: string,
): Promise<boolean> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("generated_posts")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", userId)
    .eq("day_number", dayNumber)
    .eq("format", format)
    .eq("content_hash", contentHash);

  if (error) {
    throw new AppError("Failed to check for duplicate posts.", {
      code: "DATABASE_ERROR",
    });
  }

  return (count ?? 0) > 0;
}

// ─── Publish State ──────────────────────────────────────────────────────────

export type PublishStateUpdate = {
  readonly status?: GeneratedPostStatus;
  readonly linkedin_post_id?: string | null;
  readonly published_at?: string | null;
  readonly publish_error?: string | null;
};

/**
 * Updates the publish-related state on a generated post using the provided
 * Supabase client, scoped to a single owner profile.
 *
 * Shared by:
 *   - updatePublishState (user path — ownership enforced via auth.uid())
 *   - the scheduler/cron path (server-side admin client; profile comes from
 *     the validated schedule row, never from client input).
 */
export async function updatePublishStateWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  postId: string,
  state: PublishStateUpdate,
): Promise<GeneratedPostRow> {
  const fieldsToUpdate: Record<string, unknown> = {};
  if (state.status !== undefined) fieldsToUpdate.status = state.status;
  if (state.linkedin_post_id !== undefined) fieldsToUpdate.linkedin_post_id = state.linkedin_post_id;
  if (state.published_at !== undefined) fieldsToUpdate.published_at = state.published_at;
  if (state.publish_error !== undefined) fieldsToUpdate.publish_error = state.publish_error;

  const { data, error } = await supabase
    .from("generated_posts")
    .update(fieldsToUpdate)
    .eq("id", postId)
    .eq("profile_id", profileId)
    .select()
    .single();

  if (error || !data) {
    throw new AppError("Failed to update publish state.", {
      code: "DATABASE_ERROR",
      cause: error,
    });
  }

  return data as GeneratedPostRow;
}

/**
 * Updates the publish-related state on a generated post.
 * Used after a publishing attempt (success or failure).
 * Validates ownership.
 */
export async function updatePublishState(
  postId: string,
  state: PublishStateUpdate,
): Promise<GeneratedPostRow> {
  const supabase = await createClient();
  const user = await requireAuth(supabase);

  await loadOwnPost(supabase, user.id, postId);

  return updatePublishStateWithClient(supabase, user.id, postId, state);
}
