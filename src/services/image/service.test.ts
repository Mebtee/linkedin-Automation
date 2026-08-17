import { describe, it, expect, vi } from "vitest";

// ─── Mock server-side modules ────────────────────────────────────────────────
// Server Actions with "use server" can't be imported from test environment.
// We test the service layer functions directly instead.

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "http://example.com/image.svg" } }),
      }),
    },
  }),
}));

describe("Image Service Functions", () => {
  it("getPostImage is exported", async () => {
    const { getPostImage } = await import("@/services/image/service");
    expect(typeof getPostImage).toBe("function");
  });

  it("generatePostImage is exported", async () => {
    const { generatePostImage } = await import("@/services/image/service");
    expect(typeof generatePostImage).toBe("function");
  });

  it("regeneratePostImage is exported", async () => {
    const { regeneratePostImage } = await import("@/services/image/service");
    expect(typeof regeneratePostImage).toBe("function");
  });

  it("getPostImage returns null when not authenticated", async () => {
    const { getPostImage } = await import("@/services/image/service");
    const result = await getPostImage("post-1");
    expect(result).toBeNull();
  });

  it("generatePostImage throws when not authenticated", async () => {
    const { generatePostImage } = await import("@/services/image/service");
    await expect(generatePostImage("post-1")).rejects.toThrow();
  });
});
