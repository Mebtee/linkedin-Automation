import type { GeneratedPostStatus } from "@/types/generated-post";

// ─── Schedule Status ──────────────────────────────────────────────────────────

export type ScheduleStatus =
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled";

// ─── Database Row Type ───────────────────────────────────────────────────────

export type ScheduledPostRow = {
  readonly id: string;
  readonly post_id: string;
  readonly profile_id: string;
  readonly scheduled_at: string;
  readonly status: ScheduleStatus;
  readonly published_at: string | null;
  readonly linkedin_post_id: string | null;
  readonly last_error: string | null;
  readonly attempt_count: number;
  readonly created_at: string;
  readonly updated_at: string;
};

// ─── Status Transition Map ───────────────────────────────────────────────────
//
// Explicit scheduling state machine:
//
//   scheduled ──→ publishing ──→ published   (terminal)
//        │             └─────→ failed       (terminal — retry = new schedule)
//        └────────→ cancelled               (terminal — retry = new schedule)
//
// Every transition below is executed as a conditional UPDATE guarded by the
// expected source status, so concurrent processes cannot double-apply.
export const ALLOWED_SCHEDULE_TRANSITIONS: Record<
  ScheduleStatus,
  readonly ScheduleStatus[]
> = {
  scheduled: ["publishing", "cancelled"],
  publishing: ["published", "failed"],
  published: [],
  failed: [],
  cancelled: [],
} as const;

/**
 * Returns whether a status transition is allowed by the state machine.
 */
export function canTransition(
  from: ScheduleStatus,
  to: ScheduleStatus,
): boolean {
  return ALLOWED_SCHEDULE_TRANSITIONS[from].includes(to);
}

// ─── Input Types ─────────────────────────────────────────────────────────────

export type CreateScheduleInput = {
  readonly post_id: string;
  readonly scheduled_at: string; // ISO 8601 UTC
};

export type ScheduleActionResult =
  | { readonly success: true; readonly schedule: ScheduledPostRow }
  | { readonly success: false; readonly error: { readonly code: string; readonly message: string } };

// ─── Enriched Type (Schedule + linked post) ──────────────────────────────────

export type ScheduleWithPost = ScheduledPostRow & {
  readonly post: {
    readonly id: string;
    readonly day_number: number;
    readonly opening: string;
    readonly status: GeneratedPostStatus;
  } | null;
};
