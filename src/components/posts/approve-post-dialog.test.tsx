import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApprovePostDialog } from "./approve-post-dialog";

describe("ApprovePostDialog", () => {
  const defaultProps = {
    open: true,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    isApproving: false,
  };

  it("renders when open", () => {
    render(<ApprovePostDialog {...defaultProps} />);
    expect(screen.getByText("Approve this post?")).toBeDefined();
    expect(screen.getByText(/Once approved/)).toBeDefined();
  });

  it("does not render when closed", () => {
    render(<ApprovePostDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("Approve this post?")).toBeNull();
  });

  it("shows Cancel and Approve buttons", () => {
    render(<ApprovePostDialog {...defaultProps} />);
    expect(screen.getByText("Cancel")).toBeDefined();
    expect(screen.getByText("Approve Post")).toBeDefined();
  });

  it("calls onConfirm when approve clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ApprovePostDialog {...defaultProps} onConfirm={onConfirm} />);
    await user.click(screen.getByText("Approve Post"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ApprovePostDialog {...defaultProps} onCancel={onCancel} />);
    await user.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows loading state while approving", () => {
    render(<ApprovePostDialog {...defaultProps} isApproving={true} />);
    expect(screen.getByText("Approving...")).toBeDefined();
  });

  it("has accessible dialog attributes", () => {
    render(<ApprovePostDialog {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("shows the review-required warning for needs_review posts", () => {
    render(
      <ApprovePostDialog
        {...defaultProps}
        warning="This draft is close, but the quality review flags a few areas."
      />,
    );
    expect(screen.getByText(/Review required/)).toBeDefined();
    expect(
      screen.getByText(/flags a few areas/),
    ).toBeDefined();
  });

  it("omits the warning when none is provided", () => {
    render(<ApprovePostDialog {...defaultProps} warning={null} />);
    expect(screen.queryByText(/Review required/)).toBeNull();
  });
});
