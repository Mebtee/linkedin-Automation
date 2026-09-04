import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScheduleList } from "./schedule-list";
import type { ScheduleWithPost } from "@/types/schedule";

vi.mock("@/app/actions/schedules", () => ({
  cancelScheduleAction: vi.fn(),
}));

vi.spyOn(Date.prototype, "toLocaleString").mockImplementation(function (this: Date) {
  return this.toISOString();
});

import { cancelScheduleAction } from "@/app/actions/schedules";

function makeWithPost(overrides?: Partial<ScheduleWithPost>): ScheduleWithPost {
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
    post: {
      id: "post-1",
      day_number: 12,
      opening: "Built a REST API",
      status: "approved",
    },
    ...overrides,
  };
}

const scheduled = makeWithPost();
const published = makeWithPost({
  id: "sched-2",
  status: "published",
  published_at: new Date().toISOString(),
});
const failed = makeWithPost({ id: "sched-3", status: "failed", last_error: "LinkedIn API timeout" });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ScheduleList", () => {
  it("renders each schedule with its status and linked post", () => {
    render(<ScheduleList schedules={[scheduled, published, failed]} />);

    const badges = screen
      .getAllByRole("status")
      .map((el) => el.textContent);
    expect(badges).toContain("Scheduled");
    expect(badges).toContain("Published");
    expect(badges).toContain("Failed");
    expect(screen.getAllByText(/Day 12 — Built a REST API/).length).toBe(3);
    expect(screen.getAllByText("Open Post").length).toBe(3);
  });

  it("shows the failure reason on a failed schedule", () => {
    render(<ScheduleList schedules={[failed]} />);
    expect(screen.getByText("LinkedIn API timeout")).toBeDefined();
  });

  it("shows the empty state with a link to posts when nothing is scheduled", () => {
    render(<ScheduleList schedules={[]} />);
    expect(screen.getByText("No scheduled posts")).toBeDefined();
    expect(screen.getByText("Go to Posts")).toBeDefined();
  });

  it("filters by status", async () => {
    const user = userEvent.setup();
    render(<ScheduleList schedules={[scheduled, published, failed]} />);

    await user.click(screen.getByText("Failed", { selector: "button" }));

    expect(screen.getByText(/Day 12 — Built a REST API/)).toBeDefined();
    expect(screen.getAllByText("Open Post").length).toBe(1);
  });

  it("shows no-match message when a filter excludes everything", async () => {
    const user = userEvent.setup();
    render(<ScheduleList schedules={[scheduled]} />);

    await user.click(screen.getByText("Cancelled", { selector: "button" }));

    expect(screen.getByText("No schedules match your current filters.")).toBeDefined();
  });

  it("searches by opening text", async () => {
    const user = userEvent.setup();
    const other = makeWithPost({ id: "sched-4", post_id: "post-4", post: { id: "post-4", day_number: 30, opening: "Deployed a Vite app", status: "approved" } });
    render(<ScheduleList schedules={[scheduled, other]} />);

    await user.type(screen.getByLabelText("Search schedules"), "Vite");

    expect(screen.getByText(/Day 30 — Deployed a Vite app/)).toBeDefined();
    expect(screen.queryByText(/Day 12/)).toBeNull();
  });

  it("only shows a Cancel button for scheduled status", () => {
    render(<ScheduleList schedules={[scheduled, published, failed]} />);
    const cancelButtons = screen.getAllByText("Cancel");
    expect(cancelButtons.length).toBe(1);
  });

  it("cancels a schedule and flips its status to cancelled", async () => {
    const user = userEvent.setup();
    (cancelScheduleAction as Mock).mockResolvedValue({ success: true, schedule: scheduled });
    render(<ScheduleList schedules={[scheduled]} />);

    await user.click(screen.getByText("Cancel"));

    expect(cancelScheduleAction).toHaveBeenCalledWith("sched-1");
    const badges = screen
      .getAllByRole("status")
      .map((el) => el.textContent);
    expect(badges).toContain("Cancelled");
    expect(screen.queryByText("Cancel")).toBeNull();
  });

  it("shows an error when cancelling fails", async () => {
    const user = userEvent.setup();
    (cancelScheduleAction as Mock).mockResolvedValue({
      success: false,
      error: { code: "SCHEDULE_CONFLICT", message: "It is publishing right now." },
    });
    render(<ScheduleList schedules={[scheduled]} />);

    await user.click(screen.getByText("Cancel"));

    expect(screen.getByText("It is publishing right now.")).toBeDefined();
    expect(screen.getAllByText("Scheduled").length).toBeGreaterThan(0);
  });
});