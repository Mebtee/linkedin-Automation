import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/services/scheduling", () => ({
  schedulePost: vi.fn(),
  cancelSchedule: vi.fn(),
  reschedulePost: vi.fn(),
  getActiveSchedule: vi.fn(),
}));

import {
  schedulePostAction,
  cancelScheduleAction,
  reschedulePostAction,
  getActiveScheduleAction,
} from "@/app/actions/schedules";
import {
  schedulePost,
  cancelSchedule,
  reschedulePost,
  getActiveSchedule,
} from "@/services/scheduling";
import type { ScheduledPostRow } from "@/types/schedule";

const mockSchedule: ScheduledPostRow = {
  id: "sched-1",
  post_id: "post-1",
  profile_id: "user-1",
  scheduled_at: "2026-08-21T12:00:00Z",
  status: "scheduled",
  published_at: null,
  linkedin_post_id: null,
  last_error: null,
  attempt_count: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("schedulePostAction", () => {
  it("returns success", async () => {
    (schedulePost as Mock).mockResolvedValue(mockSchedule);
    const result = await schedulePostAction("post-1", "2026-08-21T12:00:00Z");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.schedule).toEqual(mockSchedule);
    }
    expect(schedulePost).toHaveBeenCalledWith({
      post_id: "post-1",
      scheduled_at: "2026-08-21T12:00:00Z",
    });
  });

  it("returns error on failure", async () => {
    (schedulePost as Mock).mockRejectedValue(new Error("DB unavailable"));
    const result = await schedulePostAction("post-1", "2026-08-21T12:00:00Z");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe("DB unavailable");
      expect(result.error.code).toBe("SCHEDULE_FAILED");
    }
  });
});

describe("cancelScheduleAction", () => {
  it("returns success", async () => {
    (cancelSchedule as Mock).mockResolvedValue(mockSchedule);
    const result = await cancelScheduleAction("sched-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.schedule).toEqual(mockSchedule);
    }
    expect(cancelSchedule).toHaveBeenCalledWith("sched-1");
  });

  it("returns error on failure", async () => {
    (cancelSchedule as Mock).mockRejectedValue(new Error("Not found"));
    const result = await cancelScheduleAction("sched-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe("Not found");
      expect(result.error.code).toBe("CANCEL_FAILED");
    }
  });
});

describe("reschedulePostAction", () => {
  it("returns success", async () => {
    (reschedulePost as Mock).mockResolvedValue(mockSchedule);
    const result = await reschedulePostAction("sched-1", "2026-08-22T14:00:00Z");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.schedule).toEqual(mockSchedule);
    }
    expect(reschedulePost).toHaveBeenCalledWith("sched-1", "2026-08-22T14:00:00Z");
  });

  it("returns error on failure", async () => {
    (reschedulePost as Mock).mockRejectedValue(new Error("Schedule locked"));
    const result = await reschedulePostAction("sched-1", "2026-08-22T14:00:00Z");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe("Schedule locked");
      expect(result.error.code).toBe("RESCHEDULE_FAILED");
    }
  });
});

describe("getActiveScheduleAction", () => {
  it("returns schedule", async () => {
    (getActiveSchedule as Mock).mockResolvedValue(mockSchedule);
    const result = await getActiveScheduleAction("post-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.schedule).toEqual(mockSchedule);
    }
    expect(getActiveSchedule).toHaveBeenCalledWith("post-1");
  });

  it("returns null when no schedule", async () => {
    (getActiveSchedule as Mock).mockResolvedValue(null);
    const result = await getActiveScheduleAction("post-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.schedule).toBeNull();
    }
  });

  it("returns error on failure", async () => {
    (getActiveSchedule as Mock).mockRejectedValue(new Error("Connection refused"));
    const result = await getActiveScheduleAction("post-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe("Connection refused");
      expect(result.error.code).toBe("UNKNOWN");
    }
  });
});
