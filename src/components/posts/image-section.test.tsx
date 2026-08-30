import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ImageSection } from "./image-section";
import type { GeneratedPostRow } from "@/types/generated-post";
import { getPostImageAction } from "@/app/actions/post-images";

vi.mock("@/app/actions/post-images", () => ({
  generatePostImageAction: vi.fn().mockResolvedValue({
    success: false,
    error: { code: "IMAGE_UNAUTHORIZED", message: "Authentication required." },
  }),
  getPostImageAction: vi.fn().mockResolvedValue({
    success: true,
    asset: null,
  }),
  regeneratePostImageAction: vi.fn().mockResolvedValue({
    success: false,
    error: { code: "IMAGE_UNAUTHORIZED", message: "Authentication required." },
  }),
}));

const mockPost = {
  id: "post-1",
  profile_id: "user-1",
  day_number: 1,
  format: "what-i-learned",
  status: "draft",
  opening: "Test",
  body: "Test body",
  takeaway: "Test takeaway",
  next_step: "Test next",
  hashtags: ["test"],
  image_headline: null,
  image_subheadline: null,
  image_keywords: null,
  image_visual_concept: null,
  image_template: null,
  provider: "fallback",
  model: "template-v1",
  tokens_used: null,
  content_hash: "abc123",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
} as unknown as GeneratedPostRow;

describe("ImageSection", () => {
  it("renders the Image heading", async () => {
    render(<ImageSection post={mockPost} />);
    expect(screen.getByText("Image")).toBeDefined();
  });

  it("shows loading state initially", () => {
    render(<ImageSection post={mockPost} />);
    expect(screen.getByText("Loading image...")).toBeDefined();
  });

  it("shows no image message after loading", async () => {
    render(<ImageSection post={mockPost} />);
    await waitFor(() => {
      expect(screen.getByText("No image generated yet.")).toBeDefined();
    });
  });

  it("shows generate button when no image", async () => {
    render(<ImageSection post={mockPost} />);
    await waitFor(() => {
      expect(screen.getByText("Generate Image")).toBeDefined();
    });
  });

  it("shows template selector", async () => {
    render(<ImageSection post={mockPost} />);
    await waitFor(() => {
      expect(screen.getByText("Auto-select")).toBeDefined();
    });
  });

  it("shows template options", async () => {
    render(<ImageSection post={mockPost} />);
    await waitFor(() => {
      expect(screen.getByText("Large Number")).toBeDefined();
      expect(screen.getByText("Code Visual")).toBeDefined();
      expect(screen.getByText("Final Milestone")).toBeDefined();
    });
  });

  it("renders the image at the asset's own aspect ratio (wide 1200x630)", async () => {
    vi.mocked(getPostImageAction).mockResolvedValueOnce({
      success: true,
      asset: {
        id: "asset-1",
        profile_id: "user-1",
        generated_post_id: "post-1",
        storage_path: "a/b.svg",
        storage_url: "/api/media/post-1/image",
        mime_type: "image/svg+xml",
        width: 1200,
        height: 630,
        template: "concept-diagram",
        alt_text: "Day 1",
        metadata: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    });

    render(<ImageSection post={mockPost} />);
    const img = await screen.findByRole("img") as HTMLImageElement;
    // Wide aspect ratio instead of the old square 1/1.
    expect(img.style.aspectRatio).toBe("1200 / 630");
  });
});
