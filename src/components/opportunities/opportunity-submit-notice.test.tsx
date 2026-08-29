import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Mock } from "vitest";

import { OpportunitySubmitNotice } from "./opportunity-submit-notice";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/app/actions/content-opportunities", () => ({
  generateContentOpportunitiesForDayAction: vi.fn(),
}));

import { generateContentOpportunitiesForDayAction } from "@/app/actions/content-opportunities";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OpportunitySubmitNotice", () => {
  it("shows the created count and a link to opportunities", () => {
    render(
      <OpportunitySubmitNotice
        outcome={{ status: "created", count: 3 }}
        dayNumber={8}
      />,
    );

    expect(screen.getByText(/3 recruiter-focused content opportunities were built for Day 8/i)).toBeDefined();
    const link = screen.getByRole("link", { name: "View Opportunities" });
    expect(link.getAttribute("href")).toBe("/opportunities");
  });

  it("uses singular wording for a single opportunity", () => {
    render(
      <OpportunitySubmitNotice
        outcome={{ status: "created", count: 1 }}
        dayNumber={8}
      />,
    );

    expect(screen.getByText(/1 recruiter-focused content opportunity was built for Day 8/i)).toBeDefined();
  });

  it("shows the skip reason while still confirming the journal was submitted", () => {
    render(
      <OpportunitySubmitNotice
        outcome={{
          status: "skipped",
          reason: "No recruiter-focused content opportunities could be built from this entry yet.",
        }}
        dayNumber={8}
      />,
    );

    expect(screen.getByText(/Your journal was submitted\./)).toBeDefined();
    expect(screen.getByText(/No recruiter-focused content opportunities could be built/i)).toBeDefined();
    expect(screen.getByRole("link", { name: "View Opportunities" }).getAttribute("href")).toBe("/opportunities");
  });

  it("shows a retry action on failure and recovers on success", async () => {
    (generateContentOpportunitiesForDayAction as Mock).mockResolvedValueOnce({
      success: true,
      count: 2,
      opportunities: [{ id: "op-1" }, { id: "op-2" }],
    });

    render(
      <OpportunitySubmitNotice
        outcome={{ status: "failed", reason: "Your content opportunities could not be built. Try again." }}
        dayNumber={12}
      />,
    );

    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry).toBeDefined();
    expect(generateContentOpportunitiesForDayAction).not.toHaveBeenCalled();

    fireEvent.click(retry);

    await waitFor(() => {
      expect(generateContentOpportunitiesForDayAction).toHaveBeenCalledTimes(1);
      expect(generateContentOpportunitiesForDayAction).toHaveBeenCalledWith({ dayNumber: 12 });
    });
    expect(await screen.findByText(/2 recruiter-focused content opportunities were built for Day 12/i)).toBeDefined();
  });

  it("keeps the failure state and enables retry again when retry fails", async () => {
    (generateContentOpportunitiesForDayAction as Mock).mockResolvedValueOnce({
      success: false,
      error: "still down",
    });

    render(
      <OpportunitySubmitNotice
        outcome={{ status: "failed", reason: "Your content opportunities could not be built. Try again." }}
        dayNumber={5}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText(/could not be built\. Try again\./i)).toBeDefined();
    expect(screen.getByRole("button", { name: "Retry" })).toBeDefined();
  });
});