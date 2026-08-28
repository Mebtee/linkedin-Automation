import { describe, it, expect, vi, afterEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import { publishToLinkedIn } from "@/services/linkedin/publish";
import type { GeneratedPostRow } from "@/types/generated-post";

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makePost(overrides: Partial<GeneratedPostRow> = {}): GeneratedPostRow {
  return {
    id: "post-1",
    profile_id: "user-1",
    journal_entry_id: "journal-1",
    day_number: 1,
    status: "approved",
    format: "what-i-learned",
    opening: "Today I learned React hooks.",
    body: "React hooks let you use state in function components.",
    takeaway: "Hooks are powerful.",
    next_step: "Build a project.",
    hashtags: ["#React", "#Hooks"],
    image_headline: null,
    image_subheadline: null,
    image_keywords: null,
    image_visual_concept: null,
    image_template: null,
    provider: "fallback",
    model: "template-v1",
    tokens_used: null,
    content_hash: "abc123",
    linkedin_post_id: null,
    published_at: null,
    publish_error: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("LinkedIn Publish Service", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("publishToLinkedIn", () => {
    it("sends a correctly formatted UGC post to LinkedIn", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "urn:li:share:12345" }),
      });
      globalThis.fetch = mockFetch;

      const post = makePost();
      const result = await publishToLinkedIn("test-token", post, "urn:li:person:user-1");

      expect(result.success).toBe(true);
      expect(result.linkedinPostId).toBe("urn:li:share:12345");

      const [url, options] = mockFetch.mock.calls[0]!;
      expect(url).toBe("https://api.linkedin.com/v2/ugcPosts");
      expect(options.method).toBe("POST");
      expect(options.headers.Authorization).toBe("Bearer test-token");
      expect(options.headers["Content-Type"]).toBe("application/json");
      expect(options.headers["X-Restli-Protocol-Version"]).toBe("2.0.0");

      const body = JSON.parse(options.body);
      expect(body.author).toBe("urn:li:person:user-1");
      expect(body.lifecycleState).toBe("PUBLISHED");
      expect(body.specificContent["com.linkedin.ugc.ShareContent"].shareMediaCategory).toBe("NONE");
      expect(body.visibility["com.linkedin.ugc.MemberNetworkVisibility"]).toBe("PUBLIC");
    });

    it("formats post text with all sections", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "urn:li:share:999" }),
      });
      globalThis.fetch = mockFetch;

      const post = makePost({
        opening: "Hook line",
        body: "Main body text",
        takeaway: "Key takeaway",
        next_step: "Next step info",
        hashtags: ["#Tag1", "#Tag2"],
      });

      await publishToLinkedIn("token", post, "urn:li:person:u1");

      const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
      const text = body.specificContent["com.linkedin.ugc.ShareContent"].shareCommentary.text;

      expect(text).toContain("Hook line");
      expect(text).toContain("Main body text");
      expect(text).toContain("Key takeaway");
      expect(text).toContain("Next: Next step info");
      expect(text).toContain("#Tag1 #Tag2");
    });

    it("truncates text exceeding 3000 characters", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "urn:li:share:111" }),
      });
      globalThis.fetch = mockFetch;

      const longBody = "A".repeat(3000);
      const post = makePost({ body: longBody });

      await publishToLinkedIn("token", post, "urn:li:person:u1");

      const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
      const text = body.specificContent["com.linkedin.ugc.ShareContent"].shareCommentary.text;

      expect(text.length).toBeLessThanOrEqual(3000);
      expect(text).toContain("...");
    });

    it("returns INSUFFICIENT_SCOPE on 403 error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error_code: "SCOPES_INSUFFICIENT" }),
      });

      const result = await publishToLinkedIn("token", makePost(), "urn:li:person:u1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("INSUFFICIENT_SCOPE");
    });

    it("returns error for LinkedIn API failures", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: "Invalid request body" }),
      });

      const result = await publishToLinkedIn("token", makePost(), "urn:li:person:u1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("400");
      expect(result.error).toContain("Invalid request body");
    });

    it("returns error when LinkedIn returns success but no post ID", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await publishToLinkedIn("token", makePost(), "urn:li:person:u1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("no post ID");
    });

    it("handles network errors gracefully", async () => {
      globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("Network failure"));

      const result = await publishToLinkedIn("token", makePost(), "urn:li:person:u1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
      expect(result.error).toContain("Network failure");
    });

    it("detects w_member_social scope error in error detail", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error_detail: "w_member_social scope is required" }),
      });

      const result = await publishToLinkedIn("token", makePost(), "urn:li:person:u1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("INSUFFICIENT_SCOPE");
    });

    it("attaches an image: registers upload, PUTs bytes, and posts with IMAGE category", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              value: {
                uploadUrl: "https://api.linkedin.com/mediaUpload/UPLOAD1",
                asset: "urn:li:digitalmediaAsset:ASSET1",
              },
            }),
        })
        .mockResolvedValueOnce({ ok: true, status: 201, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: "urn:li:share:IMG1" }),
        });
      globalThis.fetch = mockFetch;

      const image = {
        bytes: new Uint8Array([1, 2, 3, 4]),
        mimeType: "image/png",
        altText: "Day 1 of the journey",
      };

      const result = await publishToLinkedIn(
        "token",
        makePost(),
        "urn:li:person:u1",
        image,
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // 1. Register the image upload.
      const [registerUrl, registerOpts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(registerUrl).toBe(
        "https://api.linkedin.com/v2/assets?action=registerUpload",
      );
      expect(registerOpts.method).toBe("POST");
      const registerBody = JSON.parse(registerOpts.body as string);
      expect(registerBody.registerUploadRequest.owner).toBe("urn:li:person:u1");
      expect(registerBody.registerUploadRequest.recipes).toContain(
        "urn:li:digitalmediaRecipe:feedshare-image",
      );

      // 2. PUT the image bytes to the pre-signed URL.
      const [putUrl, putOpts] = mockFetch.mock.calls[1] as [string, RequestInit];
      expect(putUrl).toBe("https://api.linkedin.com/mediaUpload/UPLOAD1");
      expect(putOpts.method).toBe("PUT");
      expect((putOpts.headers as Record<string, string>)["Content-Type"]).toBe("image/png");

      // 3. Create the UGC post referencing the asset.
      const [postUrl, postOpts] = mockFetch.mock.calls[2] as [string, RequestInit];
      expect(postUrl).toBe("https://api.linkedin.com/v2/ugcPosts");
      const postBody = JSON.parse(postOpts.body as string);
      const share = postBody.specificContent["com.linkedin.ugc.ShareContent"];
      expect(share.shareMediaCategory).toBe("IMAGE");
      expect(share.media).toEqual([
        {
          status: "READY",
          description: { text: "Day 1 of the journey" },
          media: "urn:li:digitalmediaAsset:ASSET1",
        },
      ]);
    });

    it("rasterizes SVG images to PNG before upload", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              value: {
                uploadUrl: "https://api.linkedin.com/mediaUpload/UPLOAD2",
                asset: "urn:li:digitalmediaAsset:ASSET2",
              },
            }),
        })
        .mockResolvedValueOnce({ ok: true, status: 201, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: "urn:li:share:IMG2" }),
        });
      globalThis.fetch = mockFetch;

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#0F172A"/></svg>`;

      const result = await publishToLinkedIn(
        "token",
        makePost(),
        "urn:li:person:u1",
        { bytes: new TextEncoder().encode(svg), mimeType: "image/svg+xml", altText: "" },
      );

      expect(result.success).toBe(true);
      const putOpts = mockFetch.mock.calls[1]![1] as RequestInit;
      expect((putOpts.headers as Record<string, string>)["Content-Type"]).toBe("image/png");
      const pngBytes = (putOpts.body as Uint8Array).byteLength;
      expect(pngBytes).toBeGreaterThan(100);
      // PNG signature
      const body = new Uint8Array(putOpts.body as ArrayBuffer);
      expect(Array.from(body.slice(0, 4))).toEqual([137, 80, 78, 71]);
    });

    it("returns an error when image registration fails", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: "Bad upload request" }),
      });
      globalThis.fetch = mockFetch;

      const result = await publishToLinkedIn(
        "token",
        makePost(),
        "urn:li:person:u1",
        { bytes: new Uint8Array([1]), mimeType: "image/png", altText: "" },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("image registration failed");
    });

    it("returns INSUFFICIENT_SCOPE when image registration is denied for scope", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error_code: "SCOPES_INSUFFICIENT" }),
      });
      globalThis.fetch = mockFetch;

      const result = await publishToLinkedIn(
        "token",
        makePost(),
        "urn:li:person:u1",
        { bytes: new Uint8Array([1]), mimeType: "image/png", altText: "" },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("INSUFFICIENT_SCOPE");
    });
  });
});
