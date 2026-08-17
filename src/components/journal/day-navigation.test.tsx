import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { DayNavigation } from "./day-navigation";

describe("DayNavigation", () => {
  it("renders current day and total", () => {
    render(
      <DayNavigation currentDay={18} totalDays={105} onNavigate={vi.fn()} />,
    );

    expect(screen.getByText("Day 18 / 105")).toBeDefined();
  });

  it("calls onNavigate with previous day", () => {
    const onNavigate = vi.fn();
    render(
      <DayNavigation currentDay={18} totalDays={105} onNavigate={onNavigate} />,
    );

    fireEvent.click(screen.getByText("Previous Day"));
    expect(onNavigate).toHaveBeenCalledWith(17);
  });

  it("calls onNavigate with next day", () => {
    const onNavigate = vi.fn();
    render(
      <DayNavigation currentDay={18} totalDays={105} onNavigate={onNavigate} />,
    );

    fireEvent.click(screen.getByText("Next Day"));
    expect(onNavigate).toHaveBeenCalledWith(19);
  });

  it("disables Previous Day on day 1", () => {
    render(
      <DayNavigation currentDay={1} totalDays={105} onNavigate={vi.fn()} />,
    );

    const prevButton = screen.getByText("Previous Day");
    expect(prevButton).toBeDefined();
    expect((prevButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables Next Day on last day", () => {
    render(
      <DayNavigation currentDay={105} totalDays={105} onNavigate={vi.fn()} />,
    );

    const nextButton = screen.getByText("Next Day");
    expect(nextButton).toBeDefined();
    expect((nextButton as HTMLButtonElement).disabled).toBe(true);
  });
});
