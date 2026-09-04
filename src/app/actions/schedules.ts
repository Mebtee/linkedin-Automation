"use server";

import {
  schedulePost,
  cancelSchedule,
  reschedulePost,
  getActiveSchedule,
  listUserSchedules,
} from "@/services/scheduling";
import type {
  ScheduledPostRow,
  ScheduleActionResult,
  ScheduleWithPost,
} from "@/types/schedule";

// ─── Schedule Post ──────────────────────────────────────────────────────────

export async function schedulePostAction(
  postId: string,
  scheduledAt: string,
): Promise<ScheduleActionResult> {
  try {
    const schedule = await schedulePost({ post_id: postId, scheduled_at: scheduledAt });
    return { success: true, schedule };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to schedule post.";
    const code =
      err instanceof Error && "code" in err
        ? (err as { code: string }).code
        : "SCHEDULE_FAILED";
    return { success: false, error: { code, message } };
  }
}

// ─── Cancel Schedule ────────────────────────────────────────────────────────

export async function cancelScheduleAction(
  scheduleId: string,
): Promise<ScheduleActionResult> {
  try {
    const schedule = await cancelSchedule(scheduleId);
    return { success: true, schedule };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to cancel schedule.";
    const code =
      err instanceof Error && "code" in err
        ? (err as { code: string }).code
        : "CANCEL_FAILED";
    return { success: false, error: { code, message } };
  }
}

// ─── Reschedule Post ────────────────────────────────────────────────────────

export async function reschedulePostAction(
  scheduleId: string,
  newScheduledAt: string,
): Promise<ScheduleActionResult> {
  try {
    const schedule = await reschedulePost(scheduleId, newScheduledAt);
    return { success: true, schedule };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reschedule post.";
    const code =
      err instanceof Error && "code" in err
        ? (err as { code: string }).code
        : "RESCHEDULE_FAILED";
    return { success: false, error: { code, message } };
  }
}

// ─── Get Active Schedule ─────────────────────────────────────────────────────

export async function getActiveScheduleAction(
  postId: string,
): Promise<{ success: true; schedule: ScheduledPostRow | null } | { success: false; error: { code: string; message: string } }> {
  try {
    const schedule = await getActiveSchedule(postId);
    return { success: true, schedule };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get schedule.";
    const code =
      err instanceof Error && "code" in err
        ? (err as { code: string }).code
        : "UNKNOWN";
    return { success: false, error: { code, message } };
  }
}

// ─── List Schedules ──────────────────────────────────────────────────────────

export type ListSchedulesActionResult =
  | { readonly success: true; readonly schedules: ScheduleWithPost[] }
  | { readonly success: false; readonly error: { readonly code: string; readonly message: string } };

export async function listSchedulesAction(): Promise<ListSchedulesActionResult> {
  try {
    const schedules = await listUserSchedules();
    return { success: true, schedules };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list schedules.";
    const code =
      err instanceof Error && "code" in err
        ? (err as { code: string }).code
        : "LIST_FAILED";
    return { success: false, error: { code, message } };
  }
}
