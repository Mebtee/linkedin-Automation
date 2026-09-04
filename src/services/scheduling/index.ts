import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/utils/errors";
import type { GeneratedPostRow } from "@/types/generated-post";
import {
  canTransition,
  type ScheduledPostRow,
  type CreateScheduleInput,
  type ScheduleWithPost,
} from "@/types/schedule";
import type { GeneratedPostStatus } from "@/types/generated-post";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function requireAuth(
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
  userId: string,
  postId: string,
): Promise<{ id: string; status: string }> {
  const { data, error } = await supabase
    .from("generated_posts")
    .select("id, status")
    .eq("id", postId)
    .eq("profile_id", userId)
    .single();
  if (error || !data) {
    throw new AppError("Generated post not found.", { code: "POST_NOT_FOUND" });
  }
  return data;
}

function validateScheduleTime(scheduledAt: string): void {
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) {
    throw new AppError("Invalid schedule date.", { code: "VALIDATION_ERROR" });
  }
  if (date.getTime() <= Date.now()) {
    throw new AppError("Schedule time must be in the future.", {
      code: "VALIDATION_ERROR",
    });
  }
}

// ─── Schedule ────────────────────────────────────────────────────────────────

/**
 * Creates a new schedule for an approved post.
 * Validates: post exists, is approved, has no active schedule, time is future.
 */
export async function schedulePost(
  input: CreateScheduleInput,
): Promise<ScheduledPostRow> {
  const supabase = await createClient();
  const user = await requireAuth(supabase);

  validateScheduleTime(input.scheduled_at);

  const post = await loadOwnPost(supabase, user.id, input.post_id);
  if (post.status !== "approved") {
    throw new AppError("Only approved posts can be scheduled.", {
      code: "INVALID_STATUS",
    });
  }

  const { data: existing } = await supabase
    .from("scheduled_posts")
    .select("id")
    .eq("post_id", input.post_id)
    .eq("status", "scheduled")
    .maybeSingle();

  if (existing) {
    throw new AppError(
      "This post already has an active schedule. Cancel or reschedule first.",
      { code: "ALREADY_SCHEDULED" },
    );
  }

  const { data, error } = await supabase
    .from("scheduled_posts")
    .insert({
      post_id: input.post_id,
      profile_id: user.id,
      scheduled_at: input.scheduled_at,
      status: "scheduled",
    })
    .select()
    .single();

  if (error) {
    throw new AppError("Failed to create schedule.", {
      code: "DATABASE_ERROR",
      cause: error,
    });
  }

  return data as ScheduledPostRow;
}

// ─── Cancel ──────────────────────────────────────────────────────────────────

/**
 * Cancels an active schedule. Only "scheduled" status can be cancelled.
 * The conditional UPDATE makes this safe against racing with the cron
 * publisher: if the post was just claimed (publishing), zero rows match,
 * .single() throws, and we surface a conflict instead of corrupting state.
 */
export async function cancelSchedule(
  scheduleId: string,
): Promise<ScheduledPostRow> {
  const supabase = await createClient();
  const user = await requireAuth(supabase);

  if (!canTransition("scheduled", "cancelled")) {
    throw new AppError("Invalid schedule transition: scheduled → cancelled.", {
      code: "INVALID_TRANSITION",
    });
  }

  const { data, error } = await supabase
    .from("scheduled_posts")
    .update({ status: "cancelled" })
    .eq("id", scheduleId)
    .eq("profile_id", user.id)
    .eq("status", "scheduled")
    .select()
    .single();

  if (error || !data) {
    // Either not found/not owned, or lost a race with the publisher claim.
    throw new AppError(
      "Schedule not found or is no longer cancellable.",
      { code: "SCHEDULE_NOT_FOUND" },
    );
  }

  return data as ScheduledPostRow;
}

// ─── Reschedule ──────────────────────────────────────────────────────────────

/**
 * Reschedules by cancelling the existing schedule and creating a new one.
 *
 * The cancel step is a conditional UPDATE verified to affect exactly one row.
 * If the cron publisher claimed the schedule between our load and update,
 * the cancel matches zero rows and we abort — preventing a second schedule
 * (and therefore a duplicate LinkedIn publication) for a post that is
 * already being published or was already published.
 */
export async function reschedulePost(
  scheduleId: string,
  newScheduledAt: string,
): Promise<ScheduledPostRow> {
  const supabase = await createClient();
  const user = await requireAuth(supabase);

  if (!canTransition("scheduled", "cancelled")) {
    throw new AppError("Invalid schedule transition: scheduled → cancelled.", {
      code: "INVALID_TRANSITION",
    });
  }

  const { data: existing, error: loadError } = await supabase
    .from("scheduled_posts")
    .select("id, post_id, profile_id, status")
    .eq("id", scheduleId)
    .eq("profile_id", user.id)
    .single();

  if (loadError || !existing) {
    throw new AppError("Schedule not found.", { code: "SCHEDULE_NOT_FOUND" });
  }

  if (existing.status !== "scheduled") {
    throw new AppError("Only scheduled posts can be rescheduled.", {
      code: "INVALID_STATUS",
    });
  }

  validateScheduleTime(newScheduledAt);

  // Cancel must match exactly one row; zero rows means the publisher claimed
  // it concurrently — abort instead of creating a duplicate active schedule.
  const { data: cancelled, error: cancelError } = await supabase
    .from("scheduled_posts")
    .update({ status: "cancelled" })
    .eq("id", scheduleId)
    .eq("status", "scheduled")
    .select()
    .single();

  if (cancelError || !cancelled) {
    throw new AppError(
      "This schedule is no longer active. It may be publishing right now — refresh and try again.",
      { code: "SCHEDULE_CONFLICT" },
    );
  }

  const { data: newSchedule, error: createError } = await supabase
    .from("scheduled_posts")
    .insert({
      post_id: existing.post_id,
      profile_id: user.id,
      scheduled_at: newScheduledAt,
      status: "scheduled",
    })
    .select()
    .single();

  if (createError) {
    throw new AppError("Failed to create new schedule.", {
      code: "DATABASE_ERROR",
    });
  }

  return newSchedule as ScheduledPostRow;
}

// ─── Get Active Schedule ─────────────────────────────────────────────────────

/**
 * Returns the active schedule for a post, if any.
 */
export async function getActiveSchedule(
  postId: string,
): Promise<ScheduledPostRow | null> {
  const supabase = await createClient();
  const user = await requireAuth(supabase);

  const { data } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("post_id", postId)
    .eq("profile_id", user.id)
    .eq("status", "scheduled")
    .maybeSingle();

  return (data as ScheduledPostRow) ?? null;
}

// ─── List User Schedules ─────────────────────────────────────────────────────

/**
 * Lists the authenticated user's schedules (newest first), each joined with
 * the linked generated post's display fields. Two queries total — no N+1.
 */
export async function listUserSchedules(
  limit = 100,
): Promise<ScheduleWithPost[]> {
  const supabase = await createClient();
  const user = await requireAuth(supabase);

  const { data: schedules, error: scheduleError } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("profile_id", user.id)
    .order("scheduled_at", { ascending: false })
    .limit(limit);

  if (scheduleError) {
    throw new AppError("Failed to fetch scheduled posts.", {
      code: "DATABASE_ERROR",
      cause: scheduleError,
    });
  }

  const rows = (schedules ?? []) as ScheduledPostRow[];
  if (rows.length === 0) return [];

  const postIds = rows.map((schedule) => schedule.post_id);
  const { data: posts, error: postError } = await supabase
    .from("generated_posts")
    .select("id, day_number, opening, status")
    .in("id", postIds);

  if (postError) {
    throw new AppError("Failed to fetch scheduled post details.", {
      code: "DATABASE_ERROR",
      cause: postError,
    });
  }

  type PostProjection = {
    id: string;
    day_number: number;
    opening: string;
    status: GeneratedPostStatus;
  };
  const postMap = new Map<string, PostProjection>();
  for (const post of (posts ?? []) as PostProjection[]) {
    postMap.set(post.id, post);
  }

  return rows.map<ScheduleWithPost>((schedule) => ({
    ...schedule,
    post: postMap.get(schedule.post_id) ?? null,
  }));
}

// ─── Scheduler Functions (Admin Only) ───────────────────────────────────────
//
// These functions receive a privileged (service-role) Supabase client because
// the cron publisher runs outside a user session. They are only ever called
// from the protected /api/scheduler/publish route — never from client code.
//
// Every status change is a conditional UPDATE guarded by the expected source
// status, making claims and terminal transitions atomic. Two concurrent cron
// runs can never both publish the same schedule: only one UPDATE matches.

/**
 * Finds due scheduled posts whose scheduled_at <= now.
 */
export async function findDueScheduledPosts(
  adminSupabase: SupabaseClient,
  batchSize: number = 10,
): Promise<ScheduledPostRow[]> {
  const { data, error } = await adminSupabase
    .from("scheduled_posts")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(batchSize);

  if (error) {
    throw new AppError("Failed to fetch due scheduled posts.", {
      code: "DATABASE_ERROR",
    });
  }

  return (data ?? []) as ScheduledPostRow[];
}

/**
 * Atomically claims a scheduled post for publishing by transitioning
 * scheduled → publishing.
 *
 * Returns the claimed schedule if this process won the claim, or null when
 * another process already claimed/finished it — the caller must skip.
 *
 * The conditional UPDATE (status = 'scheduled' guard) makes the claim atomic:
 * when two cron runs race, exactly one UPDATE matches the row; the loser
 * gets zero rows back and must not publish. Because the winner is unique,
 * writing nextAttemptCount (read before the claim) is race-free.
 */
export async function claimScheduledPost(
  adminSupabase: SupabaseClient,
  scheduleId: string,
  nextAttemptCount: number = 1,
): Promise<ScheduledPostRow | null> {
  const { data, error } = await adminSupabase
    .from("scheduled_posts")
    .update({
      status: "publishing",
      attempt_count: nextAttemptCount,
    })
    .eq("id", scheduleId)
    .eq("status", "scheduled")
    .select()
    .single();

  if (error || !data) return null;
  return data as ScheduledPostRow;
}

/**
 * Marks a schedule as published with the LinkedIn post ID.
 * publishing → published (guarded; a non-publishing row never transitions).
 */
export async function markSchedulePublished(
  adminSupabase: SupabaseClient,
  scheduleId: string,
  linkedinPostId: string,
): Promise<void> {
  if (!canTransition("publishing", "published")) {
    throw new AppError("Invalid schedule transition: publishing → published.", {
      code: "INVALID_TRANSITION",
    });
  }

  const { error } = await adminSupabase
    .from("scheduled_posts")
    .update({
      status: "published",
      last_error: null,
      published_at: new Date().toISOString(),
      linkedin_post_id: linkedinPostId,
    })
    .eq("id", scheduleId)
    .eq("status", "publishing");

  if (error) {
    throw new AppError("Failed to mark schedule as published.", {
      code: "DATABASE_ERROR",
    });
  }
}

/**
 * Marks a schedule as failed with the error message.
 * publishing → failed (terminal — retry happens via a brand-new schedule).
 */
export async function markScheduleFailed(
  adminSupabase: SupabaseClient,
  scheduleId: string,
  errorMessage: string,
): Promise<void> {
  if (!canTransition("publishing", "failed")) {
    throw new AppError("Invalid schedule transition: publishing → failed.", {
      code: "INVALID_TRANSITION",
    });
  }

  const { error } = await adminSupabase
    .from("scheduled_posts")
    .update({
      status: "failed",
      last_error: errorMessage,
    })
    .eq("id", scheduleId)
    .eq("status", "publishing");

  if (error) {
    throw new AppError("Failed to mark schedule as failed.", {
      code: "DATABASE_ERROR",
    });
  }
}

/**
 * Loads the full post for a scheduled publication (admin path).
 *
 * Defense-in-depth ownership check: the post's profile_id must match the
 * schedule's profile_id. The scheduler only publishes posts whose owning
 * user created the schedule — a forged post_id pointing at another user's
 * post can never be claimed/published through this path.
 */
export async function loadPostForPublishing(
  adminSupabase: SupabaseClient,
  postId: string,
  ownerProfileId: string,
): Promise<GeneratedPostRow | null> {
  const { data, error } = await adminSupabase
    .from("generated_posts")
    .select("*")
    .eq("id", postId)
    .single();

  if (error || !data) return null;

  const post = data as GeneratedPostRow;
  if (post.profile_id !== ownerProfileId) return null;

  return post;
}
