"use client";

import { useState, useCallback } from "react";
import type { ScheduledPostRow } from "@/types/schedule";

// ─── Time Helpers ────────────────────────────────────────────────────────────
//
// Timezone rules:
//   - The browser interprets <input type="date">/<input type="time"> values as
//     LOCAL wall-clock time. Combining them into one string and letting
//     `new Date()` parse it yields the correct absolute instant.
//   - Persistence: convert to UTC once via toISOString(); PostgreSQL stores
//     the timestamptz. Offsets are never manipulated manually.
//   - Display: render the stored UTC instant back through the runtime's local
//     formatter, which applies the user's current zone automatically.

/**
 * Converts a local date ("YYYY-MM-DD") and time ("HH:mm") to a UTC ISO string.
 * Returns null when either part is missing or the combination is invalid.
 */
export function localToUtc(
  date: string,
  time: string,
): string | null {
  if (!date || !time) return null;
  const instant = new Date(`${date}T${time}`);
  if (Number.isNaN(instant.getTime())) return null;
  return instant.toISOString();
}

/** Formats a stored UTC instant for display in the user's local timezone. */
export function formatDisplayDate(utcString: string): string {
  return new Date(utcString).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZoneName: "short",
  });
}

/** Today's date in the user's local timezone as "YYYY-MM-DD". */
function todayLocalDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type SchedulePanelProps = {
  existingSchedule: ScheduledPostRow | null;
  isConnected: boolean;
  isPublishing: boolean;
  onSchedule: (scheduledAt: string) => Promise<void>;
  onCancel: () => Promise<void>;
  onReschedule: (scheduleId: string, scheduledAt: string) => Promise<void>;
  onConnectLinkedIn: () => void;
};

export function SchedulePanel({
  existingSchedule,
  isConnected,
  isPublishing,
  onSchedule,
  onCancel,
  onReschedule,
  onConnectLinkedIn,
}: SchedulePanelProps) {
  const [mode, setMode] = useState<"view" | "schedule" | "reschedule">(
    existingSchedule ? "view" : "schedule",
  );
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setSelectedDate("");
    setSelectedTime("");
    setError(null);
  }, []);

  const handleScheduleSubmit = useCallback(async () => {
    const scheduledAt = localToUtc(selectedDate, selectedTime);
    if (!scheduledAt) {
      setError("Please select both date and time.");
      return;
    }
    if (new Date(scheduledAt).getTime() <= Date.now()) {
      setError("Schedule time must be in the future.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSchedule(scheduledAt);
      resetForm();
      setMode("view");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule.");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedDate, selectedTime, onSchedule, resetForm]);

  const handleRescheduleSubmit = useCallback(async () => {
    if (!existingSchedule) {
      setError("Please select both date and time.");
      return;
    }
    const scheduledAt = localToUtc(selectedDate, selectedTime);
    if (!scheduledAt) {
      setError("Please select both date and time.");
      return;
    }
    if (new Date(scheduledAt).getTime() <= Date.now()) {
      setError("Schedule time must be in the future.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onReschedule(existingSchedule.id, scheduledAt);
      resetForm();
      setMode("view");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reschedule.");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedDate, selectedTime, existingSchedule, onReschedule, resetForm]);

  const handleCancel = useCallback(async () => {
    if (!existingSchedule) return;
    setIsSubmitting(true);
    try {
      await onCancel();
      setMode("schedule");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel.");
    } finally {
      setIsSubmitting(false);
    }
  }, [existingSchedule, onCancel]);

  // View mode — show existing schedule
  if (mode === "view" && existingSchedule) {
    const tz =
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Schedule
        </h3>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
              <svg
                className="h-3 w-3"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
                  clipRule="evenodd"
                />
              </svg>
              Scheduled
            </span>
          </div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {formatDisplayDate(existingSchedule.scheduled_at)}
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Timezone: {tz}
          </p>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setMode("reschedule");
                setError(null);
              }}
              disabled={isPublishing}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Reschedule
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPublishing || isSubmitting}
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-800 dark:bg-zinc-800 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Cancel Schedule
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Schedule / Reschedule form
  const tz =
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const isReschedule = mode === "reschedule";

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {isReschedule ? "Reschedule" : "Schedule for Later"}
      </h3>

      {!isConnected && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Connect your LinkedIn account to enable scheduling.
          </p>
          <button
            type="button"
            onClick={onConnectLinkedIn}
            className="mt-2 text-xs font-medium text-[#0a66c2] hover:underline"
          >
            Connect LinkedIn
          </button>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="mt-3 space-y-3">
        <div>
          <label
            htmlFor="schedule-date"
            className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Date
          </label>
          <input
            type="date"
            id="schedule-date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            disabled={isSubmitting || isPublishing}
            min={todayLocalDateString()}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>
        <div>
          <label
            htmlFor="schedule-time"
            className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Time
          </label>
          <input
            type="time"
            id="schedule-time"
            value={selectedTime}
            onChange={(e) => setSelectedTime(e.target.value)}
            disabled={isSubmitting || isPublishing}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Your local timezone: {tz}. Times are stored in UTC.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={isReschedule ? handleRescheduleSubmit : handleScheduleSubmit}
            disabled={isSubmitting || isPublishing || !isConnected}
            className="rounded-lg bg-[#0a66c2] px-4 py-2 text-sm font-medium text-white hover:bg-[#004182] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting
              ? isReschedule
                ? "Rescheduling..."
                : "Scheduling..."
              : isReschedule
                ? "Reschedule"
                : "Schedule"}
          </button>
          {isReschedule && (
            <button
              type="button"
              onClick={() => {
                setMode("view");
                resetForm();
              }}
              disabled={isSubmitting}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
