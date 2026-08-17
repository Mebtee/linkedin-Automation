import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostActions } from "./post-actions";

const defaultProps = {
  status: "draft" as const,
  isSaving: false,
  isApproving: false,
  isRegenerating: false,
  onSave: vi.fn(),
  onApprove: vi.fn(),
  onRegenerate: vi.fn(),
  onDelete: vi.fn(),
};

describe("PostActions", () => {
  it("renders Save Draft for draft posts", () => {
    render(<PostActions {...defaultProps} />);
    expect(screen.getByText("Save Draft")).toBeDefined();
  });

  it("renders Approve Post for draft posts", () => {
    render(<PostActions {...defaultProps} />);
    expect(screen.getByText("Approve Post")).toBeDefined();
  });

  it("renders Regenerate for draft posts", () => {
    render(<PostActions {...defaultProps} />);
    expect(screen.getByText("Regenerate")).toBeDefined();
  });

  it("renders Delete for draft posts", () => {
    render(<PostActions {...defaultProps} />);
    expect(screen.getByText("Delete")).toBeDefined();
  });

  it("hides all actions for published posts", () => {
    render(<PostActions {...defaultProps} status="published" />);
    expect(screen.queryByText("Save Draft")).toBeNull();
    expect(screen.queryByText("Approve Post")).toBeNull();
    expect(screen.queryByText("Regenerate")).toBeNull();
    expect(screen.queryByText("Delete")).toBeNull();
  });

  it("shows all actions for failed posts", () => {
    render(<PostActions {...defaultProps} status="failed" />);
    expect(screen.getByText("Save Draft")).toBeDefined();
    expect(screen.getByText("Regenerate")).toBeDefined();
    expect(screen.getByText("Delete")).toBeDefined();
  });

  it("calls onSave when save button clicked", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<PostActions {...defaultProps} onSave={onSave} />);
    await user.click(screen.getByText("Save Draft"));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("calls onApprove when approve button clicked", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    render(<PostActions {...defaultProps} onApprove={onApprove} />);
    await user.click(screen.getByText("Approve Post"));
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it("calls onRegenerate when regenerate button clicked", async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn();
    render(<PostActions {...defaultProps} onRegenerate={onRegenerate} />);
    await user.click(screen.getByText("Regenerate"));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("calls onDelete when delete button clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<PostActions {...defaultProps} onDelete={onDelete} />);
    await user.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("disables buttons while saving", () => {
    render(<PostActions {...defaultProps} isSaving={true} />);
    const btn = screen.getByText("Saving...");
    expect(btn).toHaveProperty("disabled", true);
  });

  it("disables buttons while approving", () => {
    render(<PostActions {...defaultProps} isApproving={true} />);
    const btn = screen.getByText("Approving...");
    expect(btn).toHaveProperty("disabled", true);
  });

  it("disables buttons while regenerating", () => {
    render(<PostActions {...defaultProps} isRegenerating={true} />);
    const btn = screen.getByText("Regenerating...");
    expect(btn).toHaveProperty("disabled", true);
  });
});
