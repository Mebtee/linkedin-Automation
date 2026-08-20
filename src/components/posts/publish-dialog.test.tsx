import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PublishDialog } from "./publish-dialog";

const defaultProps = {
  open: true,
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
  isPublishing: false,
};

describe("PublishDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <PublishDialog {...defaultProps} open={false} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the dialog when open", () => {
    render(<PublishDialog {...defaultProps} />);
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("Publish to LinkedIn?")).toBeDefined();
    expect(screen.getByText(/will be published publicly/)).toBeDefined();
  });

  it("renders Publish and Cancel buttons", () => {
    render(<PublishDialog {...defaultProps} />);
    expect(screen.getByText("Publish")).toBeDefined();
    expect(screen.getByText("Cancel")).toBeDefined();
  });

  it("calls onConfirm when Publish clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<PublishDialog {...defaultProps} onConfirm={onConfirm} />);
    await user.click(screen.getByText("Publish"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Cancel clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<PublishDialog {...defaultProps} onCancel={onCancel} />);
    await user.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows Publishing... and disables buttons while publishing", () => {
    render(<PublishDialog {...defaultProps} isPublishing={true} />);
    expect(screen.getByText("Publishing...")).toBeDefined();
    expect(screen.getByText("Cancel")).toHaveProperty("disabled", true);
  });

  it("calls onCancel when Escape pressed", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<PublishDialog {...defaultProps} onCancel={onCancel} />);
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
