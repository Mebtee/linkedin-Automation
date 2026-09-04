import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScheduleStatusBadge } from "./schedule-status-badge";
import type { ScheduleStatus } from "@/types/schedule";

const CASES: Array<{ status: ScheduleStatus; label: string }> = [
  { status: "scheduled", label: "Scheduled" },
  { status: "publishing", label: "Publishing" },
  { status: "published", label: "Published" },
  { status: "failed", label: "Failed" },
  { status: "cancelled", label: "Cancelled" },
];

describe("ScheduleStatusBadge", () => {
  it.each(CASES)("renders $status as $label", ({ status, label }) => {
    render(<ScheduleStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeDefined();
    expect(screen.getByRole("status")).toBeDefined();
  });
});