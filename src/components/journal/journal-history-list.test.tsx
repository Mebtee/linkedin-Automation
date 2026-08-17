import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { JournalHistoryList } from "./journal-history-list";
import type { JournalHistoryItem } from "@/types/journal-history";

const makeItem = (overrides: Partial<JournalHistoryItem>): JournalHistoryItem => ({
  day_number: 1,
  topic: "Introduction to Programming",
  module_number: 1,
  module_title: "Foundations",
  status: "completed",
  what_i_learned: "Today I learned about variables and data types.",
  key_takeaway: "Variables store data that can change.",
  what_i_built: "A simple calculator.",
  confidence_level: 4,
  updated_at: "2026-08-20T14:30:00.000Z",
  ...overrides,
});

describe("JournalHistoryList", () => {
  const sampleItems: JournalHistoryItem[] = [
    makeItem({ day_number: 5, topic: "Advanced React Hooks", status: "completed" }),
    makeItem({ day_number: 3, topic: "JavaScript Closures", status: "draft", what_i_built: null }),
    makeItem({ day_number: 10, topic: "Node.js Basics", status: "completed", confidence_level: null }),
  ];

  it("renders all items by default", () => {
    render(<JournalHistoryList items={sampleItems} />);

    expect(screen.getByText("Day 5 / 105")).toBeTruthy();
    expect(screen.getByText("Day 3 / 105")).toBeTruthy();
    expect(screen.getByText("Day 10 / 105")).toBeTruthy();
  });

  it("filters completed entries", () => {
    render(<JournalHistoryList items={sampleItems} />);

    fireEvent.click(screen.getByRole("button", { name: "Completed" }));

    expect(screen.getByText("Day 5 / 105")).toBeTruthy();
    expect(screen.getByText("Day 10 / 105")).toBeTruthy();
    expect(screen.queryByText("Day 3 / 105")).toBeNull();
  });

  it("filters draft entries", () => {
    render(<JournalHistoryList items={sampleItems} />);

    fireEvent.click(screen.getByRole("button", { name: "Drafts" }));

    expect(screen.getByText("Day 3 / 105")).toBeTruthy();
    expect(screen.queryByText("Day 5 / 105")).toBeNull();
    expect(screen.queryByText("Day 10 / 105")).toBeNull();
  });

  it("searches by day number", () => {
    render(<JournalHistoryList items={sampleItems} />);

    fireEvent.change(screen.getByPlaceholderText("Search day, topic..."), {
      target: { value: "5" },
    });

    expect(screen.getByText("Day 5 / 105")).toBeTruthy();
    expect(screen.queryByText("Day 3 / 105")).toBeNull();
    expect(screen.queryByText("Day 10 / 105")).toBeNull();
  });

  it("searches by topic", () => {
    render(<JournalHistoryList items={sampleItems} />);

    fireEvent.change(screen.getByPlaceholderText("Search day, topic..."), {
      target: { value: "Hooks" },
    });

    expect(screen.getByText("Day 5 / 105")).toBeTruthy();
    expect(screen.queryByText("Day 3 / 105")).toBeNull();
  });

  it("searches by module title", () => {
    render(<JournalHistoryList items={sampleItems} />);

    fireEvent.change(screen.getByPlaceholderText("Search day, topic..."), {
      target: { value: "Foundations" },
    });

    expect(screen.getByText("Day 5 / 105")).toBeTruthy();
    expect(screen.getByText("Day 3 / 105")).toBeTruthy();
  });

  it("sorts oldest first", () => {
    render(<JournalHistoryList items={sampleItems} />);

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "oldest" },
    });

    const dayHeaders = screen.getAllByText(/Day \d+ \/ 105/);
    expect(dayHeaders[0]?.textContent).toContain("Day 3");
    expect(dayHeaders[1]?.textContent).toContain("Day 5");
    expect(dayHeaders[2]?.textContent).toContain("Day 10");
  });

  it("sorts newest first by default", () => {
    render(<JournalHistoryList items={sampleItems} />);

    const dayHeaders = screen.getAllByText(/Day \d+ \/ 105/);
    expect(dayHeaders[0]?.textContent).toContain("Day 10");
    expect(dayHeaders[1]?.textContent).toContain("Day 5");
    expect(dayHeaders[2]?.textContent).toContain("Day 3");
  });

  it("shows empty state when no items", () => {
    render(<JournalHistoryList items={[]} />);

    expect(screen.getByText("Start Today's Journal")).toBeTruthy();
  });

  it("shows 'no results' when filters match nothing", () => {
    render(<JournalHistoryList items={sampleItems} />);

    fireEvent.change(screen.getByPlaceholderText("Search day, topic..."), {
      target: { value: "xyz999" },
    });

    expect(screen.getByText("No entries match your filters.")).toBeTruthy();
  });

  it("shows View Journal for completed entries", () => {
    render(<JournalHistoryList items={[makeItem({ day_number: 1, status: "completed" })]} />);

    expect(screen.getByText("View Journal")).toBeTruthy();
  });

  it("shows Continue Journal for draft entries", () => {
    render(<JournalHistoryList items={[makeItem({ day_number: 1, status: "draft" })]} />);

    expect(screen.getByText("Continue Journal")).toBeTruthy();
  });

  it("links View Journal to correct day", () => {
    render(<JournalHistoryList items={[makeItem({ day_number: 7, status: "completed" })]} />);

    const link = screen.getByText("View Journal").closest("a");
    expect(link?.getAttribute("href")).toBe("/journal?day=7");
  });

  it("links Continue Journal to correct day", () => {
    render(<JournalHistoryList items={[makeItem({ day_number: 12, status: "draft" })]} />);

    const link = screen.getByText("Continue Journal").closest("a");
    expect(link?.getAttribute("href")).toBe("/journal?day=12");
  });

  it("displays confidence level when present", () => {
    render(<JournalHistoryList items={[makeItem({ day_number: 1, confidence_level: 4 })]} />);

    expect(screen.getByText(/Confidence: 4 \/ 5/)).toBeTruthy();
  });

  it("does not display confidence when null", () => {
    render(<JournalHistoryList items={[makeItem({ day_number: 1, confidence_level: null })]} />);

    expect(screen.queryByText(/Confidence/)).toBeNull();
  });

  it("truncates long preview text", () => {
    const longText = "A".repeat(200);
    render(
      <JournalHistoryList
        items={[makeItem({ day_number: 1, what_i_learned: longText })]}
      />,
    );

    const learned = screen.getByText(/Learned:/);
    expect(learned.textContent?.length).toBeLessThan(200);
  });

  it("shows entries count", () => {
    render(<JournalHistoryList items={sampleItems} />);

    expect(screen.getByText("3 entries found")).toBeTruthy();
  });

  it("shows singular entry count", () => {
    render(<JournalHistoryList items={[makeItem({ day_number: 1 })]} />);

    expect(screen.getByText("1 entry found")).toBeTruthy();
  });
});
