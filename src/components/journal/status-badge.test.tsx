import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("renders draft status", () => {
    render(<StatusBadge status="draft" />);
    expect(screen.getByText("Draft")).toBeDefined();
    expect(screen.getByText("You can keep editing.")).toBeDefined();
  });

  it("renders submitted status", () => {
    render(<StatusBadge status="submitted" />);
    expect(screen.getByText("Submitted")).toBeDefined();
    expect(screen.getByText("Your learning record is saved.")).toBeDefined();
  });

  it("renders used status", () => {
    render(<StatusBadge status="used" />);
    expect(screen.getByText("Used")).toBeDefined();
    expect(screen.getByText("Used by content generation.")).toBeDefined();
  });
});
