import { describe, it, expect, vi } from "vitest";

// ─── Mock server-side modules ────────────────────────────────────────────────
// Server Actions with "use server" can't be imported from test environment.

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
  }),
}));

vi.mock("@/services/image/service", () => ({
  generatePostImage: vi.fn().mockRejectedValue(new Error("Not authenticated")),
  getPostImage: vi.fn().mockResolvedValue(null),
  regeneratePostImage: vi.fn().mockRejectedValue(new Error("Not authenticated")),
}));

describe("Post Image Server Actions", () => {
  it("server actions module is importable", async () => {
    // Verify the action module structure exists
    const mod = await import("@/app/actions/post-images");
    expect(typeof mod.generatePostImageAction).toBe("function");
    expect(typeof mod.getPostImageAction).toBe("function");
    expect(typeof mod.regeneratePostImageAction).toBe("function");
  });

  it("generatePostImageAction never throws", async () => {
    const { generatePostImageAction } = await import("@/app/actions/post-images");
    await expect(generatePostImageAction("post-1")).resolves.toBeDefined();
  });

  it("getPostImageAction never throws", async () => {
    const { getPostImageAction } = await import("@/app/actions/post-images");
    await expect(getPostImageAction("post-1")).resolves.toBeDefined();
  });

  it("regeneratePostImageAction never throws", async () => {
    const { regeneratePostImageAction } = await import("@/app/actions/post-images");
    await expect(regeneratePostImageAction("post-1")).resolves.toBeDefined();
  });

  it("generatePostImageAction returns error result on failure", async () => {
    const { generatePostImageAction } = await import("@/app/actions/post-images");
    const result = await generatePostImageAction("post-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(typeof result.error.code).toBe("string");
      expect(typeof result.error.message).toBe("string");
    }
  });

  it("getPostImageAction returns null asset", async () => {
    const { getPostImageAction } = await import("@/app/actions/post-images");
    const result = await getPostImageAction("post-1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.asset).toBeNull();
    }
  });
});
