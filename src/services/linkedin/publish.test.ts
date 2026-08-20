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
  });
});
