import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/settings",
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import { LinkedInConnectionCard } from "./linkedin-connection-card";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("LinkedInConnectionCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no URL params
    Object.defineProperty(window, "location", {
      value: { href: "http://localhost:3000/settings", search: "", replace: vi.fn() },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading skeleton initially", async () => {
    // Never resolve the fetch so component stays in loading state
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    const { container } = render(<LinkedInConnectionCard />);

    // Loading skeleton has animate-pulse class
    const pulseEl = container.querySelector(".animate-pulse");
    expect(pulseEl).toBeTruthy();
  });

  it("displays disconnected state after loading", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "disconnected",
          connected_at: null,
          linkedin_name: null,
          linkedin_email: null,
        }),
    });

    render(<LinkedInConnectionCard />);

    await waitFor(() => {
      expect(screen.getByText("Not connected")).toBeTruthy();
    });

    expect(screen.getByText("LinkedIn Account")).toBeTruthy();
    expect(screen.getByText("Connect LinkedIn")).toBeTruthy();
  });

  it("displays connected state with user info", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "connected",
          connected_at: "2026-08-01T00:00:00Z",
          linkedin_name: "John Doe",
          linkedin_email: "john@example.com",
        }),
    });

    render(<LinkedInConnectionCard />);

    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeTruthy();
    });

    expect(screen.getByText("John Doe")).toBeTruthy();
    expect(screen.getByText("john@example.com")).toBeTruthy();
    expect(screen.getByText("Disconnect")).toBeTruthy();
  });

  it("displays expired state with reconnect button", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "expired",
          connected_at: "2026-06-01T00:00:00Z",
          linkedin_name: "John Doe",
          linkedin_email: "john@example.com",
        }),
    });

    render(<LinkedInConnectionCard />);

    await waitFor(() => {
      expect(screen.getByText("Token expired")).toBeTruthy();
    });

    expect(screen.getByText("Reconnect")).toBeTruthy();
  });

  it("navigates to /api/linkedin/auth when connect is clicked", async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "disconnected",
          connected_at: null,
          linkedin_name: null,
          linkedin_email: null,
        }),
    });

    // Mock window.location.href setter
    let capturedHref = "";
    Object.defineProperty(window, "location", {
      value: {
        get href() {
          return "http://localhost:3000/settings";
        },
        set href(val: string) {
          capturedHref = val;
        },
        search: "",
        replace: vi.fn(),
      },
      writable: true,
    });

    render(<LinkedInConnectionCard />);

    await waitFor(() => {
      expect(screen.getByText("Connect LinkedIn")).toBeTruthy();
    });

    await user.click(screen.getByText("Connect LinkedIn"));

    expect(capturedHref).toBe("/api/linkedin/auth");
  });

  it("calls POST /api/linkedin/disconnect when disconnect is clicked", async () => {
    const user = userEvent.setup();

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "connected",
            connected_at: "2026-08-01T00:00:00Z",
            linkedin_name: "John Doe",
            linkedin_email: "john@example.com",
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

    render(<LinkedInConnectionCard />);

    await waitFor(() => {
      expect(screen.getByText("Disconnect")).toBeTruthy();
    });

    await user.click(screen.getByText("Disconnect"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/linkedin/disconnect", {
        method: "POST",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("LinkedIn account disconnected.")).toBeTruthy();
      expect(screen.getByText("Not connected")).toBeTruthy();
    });
  });

  it("shows success message from URL callback params", async () => {
    Object.defineProperty(window, "location", {
      value: {
        href: "http://localhost:3000/settings?linkedin=connected",
        search: "?linkedin=connected",
        replace: vi.fn(),
      },
      writable: true,
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "connected",
          connected_at: "2026-08-01T00:00:00Z",
          linkedin_name: "John Doe",
          linkedin_email: "john@example.com",
        }),
    });

    render(<LinkedInConnectionCard />);

    await waitFor(() => {
      expect(
        screen.getByText("LinkedIn account connected successfully."),
      ).toBeTruthy();
    });
  });

  it("shows error message for denied callback", async () => {
    Object.defineProperty(window, "location", {
      value: {
        href: "http://localhost:3000/settings?linkedin=denied",
        search: "?linkedin=denied",
        replace: vi.fn(),
      },
      writable: true,
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "disconnected",
          connected_at: null,
          linkedin_name: null,
          linkedin_email: null,
        }),
    });

    render(<LinkedInConnectionCard />);

    await waitFor(() => {
      expect(
        screen.getByText("LinkedIn authorization was denied."),
      ).toBeTruthy();
    });
  });

  it("can dismiss the message banner", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "disconnected",
          connected_at: null,
          linkedin_name: null,
          linkedin_email: null,
        }),
    });

    const user = userEvent.setup();

    render(<LinkedInConnectionCard />);

    // Inject a message via the component state by simulating a callback
    Object.defineProperty(window, "location", {
      value: {
        href: "http://localhost:3000/settings?linkedin=connected",
        search: "?linkedin=connected",
        replace: vi.fn(),
      },
      writable: true,
    });

    // Re-render with the message
    const { unmount } = render(<LinkedInConnectionCard />);

    await waitFor(() => {
      expect(screen.getByText("LinkedIn account connected successfully.")).toBeTruthy();
    });

    const dismissButton = screen.getByLabelText("Dismiss");
    await user.click(dismissButton);

    await waitFor(() => {
      expect(screen.queryByText("LinkedIn account connected successfully.")).toBeNull();
    });

    unmount();
  });
});
