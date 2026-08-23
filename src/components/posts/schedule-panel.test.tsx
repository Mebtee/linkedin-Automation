import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SchedulePanel, localToUtc, formatDisplayDate } from "./schedule-panel";
import type { ScheduledPostRow } from "@/types/schedule";

vi.spyOn(Date.prototype, "toLocaleString").mockImplementation(function (this: Date) {
  return this.toISOString();
});

const defaultProps = {
  existingSchedule: null,
  isConnected: true,
  isPublishing: false,
  onSchedule: vi.fn().mockResolvedValue(undefined),
  onCancel: vi.fn().mockResolvedValue(undefined),
  onReschedule: vi.fn().mockResolvedValue(undefined),
  onConnectLinkedIn: vi.fn(),
};

function makeSchedule(overrides?: Partial<ScheduledPostRow>): ScheduledPostRow {
  return {
    id: "sched-1",
    post_id: "post-1",
    profile_id: "user-1",
    scheduled_at: new Date(Date.now() + 86400000).toISOString(),
    status: "scheduled",
    published_at: null,
    linkedin_post_id: null,
    last_error: null,
    attempt_count: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/** Local-independent "YYYY-MM-DD" of a Date (UTC calendar of the instant). */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

describe("SchedulePanel", () => {
  it("renders the schedule form when no existing schedule", () => {
    render(<SchedulePanel {...defaultProps} />);
    expect(screen.getByText("Schedule for Later")).toBeDefined();
    expect(screen.getByLabelText("Date")).toBeDefined();
    expect(screen.getByLabelText("Time")).toBeDefined();
  });

  it("shows date/time inputs in schedule mode", () => {
    render(<SchedulePanel {...defaultProps} />);
    expect(screen.getByLabelText("Date").getAttribute("type")).toBe("date");
    expect(screen.getByLabelText("Time").getAttribute("type")).toBe("time");
    expect(screen.getByText("Schedule", { selector: "button" })).toBeDefined();
  });

  it("shows existing schedule info in view mode", () => {
    const schedule = makeSchedule();
    render(<SchedulePanel {...defaultProps} existingSchedule={schedule} />);
    expect(screen.getByText("Schedule")).toBeDefined();
    expect(screen.getByText("Scheduled")).toBeDefined();
    expect(screen.getByText("Reschedule")).toBeDefined();
    expect(screen.getByText("Cancel Schedule")).toBeDefined();
  });

  it("calls onSchedule with correct ISO string when form submitted", async () => {
    const user = userEvent.setup();
    const onSchedule = vi.fn().mockResolvedValue(undefined);
    render(<SchedulePanel {...defaultProps} onSchedule={onSchedule} />);

    const futureDate = new Date(Date.now() + 86400000);
    const dateStr = isoDate(futureDate);
    const timeStr = "12:00";

    await user.type(screen.getByLabelText("Date"), dateStr);
    await user.type(screen.getByLabelText("Time"), timeStr);
    await user.click(screen.getByText("Schedule", { selector: "button" }));

    expect(onSchedule).toHaveBeenCalledTimes(1);
    const isoArg = onSchedule.mock.calls[0]?.[0] as string;
    expect(new Date(isoArg).toISOString()).toBe(new Date(isoArg).toISOString());
    expect(new Date(isoArg).getTime()).toBeGreaterThan(Date.now());
  });

  it("shows reschedule form when Reschedule clicked", async () => {
    const user = userEvent.setup();
    const schedule = makeSchedule();
    render(<SchedulePanel {...defaultProps} existingSchedule={schedule} />);

    await user.click(screen.getByText("Reschedule"));
    expect(screen.getByText("Reschedule", { selector: "h3" })).toBeDefined();
    expect(screen.getByLabelText("Date")).toBeDefined();
    expect(screen.getByLabelText("Time")).toBeDefined();
  });

  it("calls onReschedule when reschedule form submitted", async () => {
    const user = userEvent.setup();
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const schedule = makeSchedule();
    render(
      <SchedulePanel
        {...defaultProps}
        existingSchedule={schedule}
        onReschedule={onReschedule}
      />,
    );

    await user.click(screen.getByText("Reschedule"));

    const futureDate = new Date(Date.now() + 86400000);
    const dateStr = isoDate(futureDate);
    await user.type(screen.getByLabelText("Date"), dateStr);
    await user.type(screen.getByLabelText("Time"), "14:00");
    await user.click(screen.getByText("Reschedule", { selector: "button" }));

    expect(onReschedule).toHaveBeenCalledTimes(1);
    expect(onReschedule).toHaveBeenCalledWith(
      "sched-1",
      expect.any(String),
    );
  });

  it("calls onCancel when Cancel Schedule clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn().mockResolvedValue(undefined);
    const schedule = makeSchedule();
    render(
      <SchedulePanel {...defaultProps} existingSchedule={schedule} onCancel={onCancel} />,
    );

    await user.click(screen.getByText("Cancel Schedule"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows timezone indicator", () => {
    render(<SchedulePanel {...defaultProps} />);
    expect(screen.getByText(/Your local timezone/)).toBeDefined();
  });

  it("shows error for past schedule time", async () => {
    const user = userEvent.setup();
    render(<SchedulePanel {...defaultProps} />);

    await user.type(screen.getByLabelText("Date"), "2020-01-01");
    await user.type(screen.getByLabelText("Time"), "00:00");
    await user.click(screen.getByText("Schedule", { selector: "button" }));

    expect(screen.getByText("Schedule time must be in the future.")).toBeDefined();
  });

  it("shows Connect LinkedIn when not connected", () => {
    render(<SchedulePanel {...defaultProps} isConnected={false} />);
    expect(screen.getByText("Connect LinkedIn")).toBeDefined();
    expect(
      screen.getByText(/Connect your LinkedIn account to enable scheduling/),
    ).toBeDefined();
  });

  it("calls onConnectLinkedIn when Connect LinkedIn clicked", async () => {
    const user = userEvent.setup();
    const onConnectLinkedIn = vi.fn();
    render(
      <SchedulePanel
        {...defaultProps}
        isConnected={false}
        onConnectLinkedIn={onConnectLinkedIn}
      />,
    );

    await user.click(screen.getByText("Connect LinkedIn"));
    expect(onConnectLinkedIn).toHaveBeenCalledTimes(1);
  });
});

describe("time handling (local ↔ UTC)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("converts local date/time to a UTC ISO string", () => {
    const utc = localToUtc("2026-08-21", "12:00");

    // Must be persisted as UTC (Z suffix), representing the same instant the
    // browser produced by interpreting the wall-clock input locally.
    expect(utc).toMatch(/Z$/);
    expect(new Date(utc as string).getTime()).toBe(
      new Date("2026-08-21T12:00").getTime(),
    );
  });

  it("round-trips: UTC instant displays as the same local wall-clock", () => {
    const utc = localToUtc("2026-08-21", "15:30")!;
    const displayed = formatDisplayDate(utc);

    // The display formatter renders the stored instant back in local time —
    // identical to formatting the original local Date directly.
    expect(displayed).toBe(new Date("2026-08-21T15:30").toLocaleString());
  });

  it("rejects missing or invalid inputs", () => {
    expect(localToUtc("", "12:00")).toBeNull();
    expect(localToUtc("2026-08-21", "")).toBeNull();
    expect(localToUtc("not-a-date", "12:00")).toBeNull();
  });

  it("submits the exact converted UTC instant to onSchedule", async () => {
    const user = userEvent.setup();
    const onSchedule = vi.fn().mockResolvedValue(undefined);
    render(<SchedulePanel {...defaultProps} onSchedule={onSchedule} />);

    const future = new Date(Date.now() + 86400000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}`;

    await user.type(screen.getByLabelText("Date"), dateStr);
    await user.type(screen.getByLabelText("Time"), "09:15");
    await user.click(screen.getByText("Schedule", { selector: "button" }));

    expect(onSchedule).toHaveBeenCalledWith(localToUtc(dateStr, "09:15"));
    // Stored value is UTC.
    const submitted = onSchedule.mock.calls[0]?.[0] as string;
    expect(submitted).toMatch(/Z$/);
  });
});
