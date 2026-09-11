import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

// ─── Imports ─────────────────────────────────────────────────────────────────

import { requireAuthWithClient } from "@/lib/auth";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeClient(userId: string | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  } as unknown as SupabaseClient;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("requireAuthWithClient (centralised auth helper)", () => {
  it("returns the user object when authenticated", async () => {
    const client = makeClient("user-123");
    const user = await requireAuthWithClient(client);
    expect(user.id).toBe("user-123");
  });

  it("throws AppError with default code AUTH_REQUIRED when not authenticated", async () => {
    const client = makeClient(null);
    await expect(requireAuthWithClient(client)).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
      message: "Authentication required.",
    });
  });

  it("throws AppError with custom message and code when provided", async () => {
    const client = makeClient(null);
    await expect(
      requireAuthWithClient(client, "Authentication required to generate posts.", "GENERATION_UNAUTHORIZED"),
    ).rejects.toMatchObject({
      code: "GENERATION_UNAUTHORIZED",
      message: "Authentication required to generate posts.",
    });
  });

  it("preserves GENERATION_UNAUTHORIZED semantics for ai/generation.ts consumer", async () => {
    const client = makeClient(null);
    await expect(
      requireAuthWithClient(client, "Authentication required to generate posts.", "GENERATION_UNAUTHORIZED"),
    ).rejects.toThrow("Authentication required to generate posts.");
  });

  it("calls supabase.auth.getUser() exactly once per call", async () => {
    const client = makeClient("user-abc");
    await requireAuthWithClient(client);
    expect((client.auth.getUser as ReturnType<typeof vi.fn>)).toHaveBeenCalledOnce();
  });
});
