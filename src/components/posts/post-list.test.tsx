import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostList } from "./post-list";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}));

const mockPosts = [
  {
    id: "post-1",
    profile_id: "user-1",
    journal_entry_id: "journal-1",
    day_number: 1,
    status: "draft" as const,
    format: "what-i-learned" as const,
    opening: "Today I learned Git.",
    body: "Git is a version control system.",
    takeaway: "Git saves versions.",
    next_step: "Learn branches.",
    hashtags: ["#105DaysOfCode", "#Git"],
    image_headline: null,
    image_subheadline: null,
    image_keywords: null,
    image_visual_concept: null,
    image_template: null,
    provider: "fallback",
    model: "template-v1",
    tokens_used: null,
    content_hash: "abc123",
    created_at: "2026-08-17T10:00:00Z",
    updated_at: "2026-08-17T10:00:00Z",
  },
  {
    id: "post-2",
    profile_id: "user-1",
    journal_entry_id: "journal-2",
    day_number: 2,
    status: "approved" as const,
    format: "challenge" as const,
    opening: "Struggled with CSS today.",
    body: "CSS positioning is confusing.",
    takeaway: "Practice makes perfect.",
    next_step: "Build a project.",
    hashtags: ["#CSS", "#Learning"],
    image_headline: null,
    image_subheadline: null,
    image_keywords: null,
    image_visual_concept: null,
    image_template: null,
    provider: "fallback",
    model: "template-v1",
    tokens_used: null,
    content_hash: "def456",
    created_at: "2026-08-18T10:00:00Z",
    updated_at: "2026-08-18T10:00:00Z",
  },
];

describe("PostList", () => {
  it("renders all posts", () => {
    render(<PostList posts={mockPosts} />);
    expect(screen.getByText("Today I learned Git.")).toBeDefined();
    expect(screen.getByText("Struggled with CSS today.")).toBeDefined();
  });

  it("shows empty state when no posts", () => {
    render(<PostList posts={[]} />);
    expect(screen.getByText("No posts yet")).toBeDefined();
  });

  it("renders filter buttons", () => {
    render(<PostList posts={mockPosts} />);
    expect(screen.getByText("All")).toBeDefined();
    expect(screen.getByRole("button", { name: "Draft" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Approved" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Published" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Failed" })).toBeDefined();
  });

  it("filters by status when Draft button clicked", async () => {
    const user = userEvent.setup();
    render(<PostList posts={mockPosts} />);
    await user.click(screen.getByRole("button", { name: "Draft" }));
    expect(screen.getByText("Today I learned Git.")).toBeDefined();
    expect(screen.queryByText("Struggled with CSS today.")).toBeNull();
  });

  it("filters by status when Approved button clicked", async () => {
    const user = userEvent.setup();
    render(<PostList posts={mockPosts} />);
    await user.click(screen.getByRole("button", { name: "Approved" }));
    expect(screen.queryByText("Today I learned Git.")).toBeNull();
    expect(screen.getByText("Struggled with CSS today.")).toBeDefined();
  });

  it("shows no results message when filter matches nothing", async () => {
    const user = userEvent.setup();
    render(<PostList posts={mockPosts} />);
    await user.click(screen.getByRole("button", { name: "Failed" }));
    expect(screen.getByText("No posts match your current filters.")).toBeDefined();
  });

  it("searches by day number", async () => {
    const user = userEvent.setup();
    render(<PostList posts={mockPosts} />);
    await user.type(screen.getByPlaceholderText("Search posts..."), "1");
    expect(screen.getByText("Today I learned Git.")).toBeDefined();
    expect(screen.queryByText("Struggled with CSS today.")).toBeNull();
  });

  it("searches by opening text", async () => {
    const user = userEvent.setup();
    render(<PostList posts={mockPosts} />);
    await user.type(screen.getByPlaceholderText("Search posts..."), "CSS");
    expect(screen.queryByText("Today I learned Git.")).toBeNull();
    expect(screen.getByText("Struggled with CSS today.")).toBeDefined();
  });
});
