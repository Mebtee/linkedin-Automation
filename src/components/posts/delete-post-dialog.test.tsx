import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeletePostDialog } from "./delete-post-dialog";

describe("DeletePostDialog", () => {
  const defaultProps = {
    open: true,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    isDeleting: false,
  };

  it("renders when open", () => {
    render(<DeletePostDialog {...defaultProps} />);
    expect(screen.getByText("Delete this post?")).toBeDefined();
    expect(screen.getByText(/will be removed/)).toBeDefined();
  });

  it("does not render when closed", () => {
    render(<DeletePostDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("Delete this post?")).toBeNull();
  });

  it("shows Cancel and Delete buttons", () => {
    render(<DeletePostDialog {...defaultProps} />);
    expect(screen.getByText("Cancel")).toBeDefined();
    expect(screen.getByText("Delete")).toBeDefined();
  });

  it("calls onConfirm when delete clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<DeletePostDialog {...defaultProps} onConfirm={onConfirm} />);
    await user.click(screen.getByText("Delete"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<DeletePostDialog {...defaultProps} onCancel={onCancel} />);
    await user.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows loading state while deleting", () => {
    render(<DeletePostDialog {...defaultProps} isDeleting={true} />);
    expect(screen.getByText("Deleting...")).toBeDefined();
  });

  it("has accessible dialog attributes", () => {
    render(<DeletePostDialog {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });
});
