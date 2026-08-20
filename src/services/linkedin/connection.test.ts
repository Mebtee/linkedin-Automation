import { describe, it, expect, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getConnectionStatus,
  getAccessToken,
  upsertConnection,
  deleteConnection,
} from "@/services/linkedin/connection";
import type { SupabaseClient } from "@supabase/supabase-js";

type MockOverrides = {
  selectData?: unknown;
  selectError?: { message: string } | null;
  upsertError?: { message: string } | null;
  deleteError?: { message: string } | null;
};

function createMockSupabase(overrides: MockOverrides = {}): SupabaseClient {
  const eqResult = { error: overrides.deleteError ?? null };
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue({
      data: overrides.selectData ?? null,
      error: overrides.selectError ?? null,
    }),
    upsert: vi.fn().mockResolvedValue({ error: overrides.upsertError ?? null }),
    delete: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.delete.mockReturnValue(chain);
  chain.eq.mockImplementation(() => {
    if (chain.delete.mock.calls.length > 0 && chain.upsert.mock.calls.length === 0) {
      return Promise.resolve(eqResult);
    }
    return chain;
  });
  return { from: vi.fn().mockReturnValue(chain) } as unknown as SupabaseClient;
}

function createMockSupabaseForToken(
  data: { access_token: string; expires_at: string | null; scope: string } | null,
): SupabaseClient {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue({ data, error: data === null ? { message: "not found" } : null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    delete: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.delete.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return { from: vi.fn().mockReturnValue(chain) } as unknown as SupabaseClient;
}

describe("LinkedIn Connection Service", () => {
  describe("getConnectionStatus", () => {
    it("returns disconnected when no connection exists", async () => {
      const supabase = createMockSupabase({ selectData: null });
      const result = await getConnectionStatus(supabase, "user-1");
      expect(result.status).toBe("disconnected");
      expect(result.connected_at).toBeNull();
    });

    it("returns connected when token has not expired", async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString();
      const supabase = createMockSupabase({
        selectData: { expires_at: futureDate, linkedin_name: "John Doe", linkedin_email: "john@example.com", created_at: "2026-01-01T00:00:00Z" },
      });
      const result = await getConnectionStatus(supabase, "user-1");
      expect(result.status).toBe("connected");
      expect(result.linkedin_name).toBe("John Doe");
    });

    it("returns expired when token has expired", async () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString();
      const supabase = createMockSupabase({
        selectData: { expires_at: pastDate, linkedin_name: "John Doe", linkedin_email: "john@example.com", created_at: "2026-01-01T00:00:00Z" },
      });
      const result = await getConnectionStatus(supabase, "user-1");
      expect(result.status).toBe("expired");
    });

    it("returns connected when expires_at is null", async () => {
      const supabase = createMockSupabase({
        selectData: { expires_at: null, linkedin_name: "John Doe", linkedin_email: "john@example.com", created_at: "2026-01-01T00:00:00Z" },
      });
      const result = await getConnectionStatus(supabase, "user-1");
      expect(result.status).toBe("connected");
    });

    it("queries the correct table", async () => {
      const supabase = createMockSupabase({ selectData: null });
      await getConnectionStatus(supabase, "user-42");
      expect(supabase.from).toHaveBeenCalledWith("linkedin_connections");
    });
  });

  describe("getAccessToken", () => {
    it("returns token and hasPublishScope=true when w_member_social present", async () => {
      const supabase = createMockSupabaseForToken({
        access_token: "my-secret-token",
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        scope: "openid profile email w_member_social",
      });
      const result = await getAccessToken(supabase, "user-1");
      expect(result).not.toBeNull();
      expect(result!.token).toBe("my-secret-token");
      expect(result!.hasPublishScope).toBe(true);
    });

    it("returns hasPublishScope=false when w_member_social absent", async () => {
      const supabase = createMockSupabaseForToken({
        access_token: "my-token",
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        scope: "openid profile email",
      });
      const result = await getAccessToken(supabase, "user-1");
      expect(result).not.toBeNull();
      expect(result!.hasPublishScope).toBe(false);
    });

    it("returns null when no connection exists", async () => {
      const supabase = createMockSupabaseForToken(null);
      const result = await getAccessToken(supabase, "user-1");
      expect(result).toBeNull();
    });

    it("returns null when token is expired", async () => {
      const supabase = createMockSupabaseForToken({
        access_token: "expired-token",
        expires_at: new Date(Date.now() - 3600000).toISOString(),
        scope: "openid profile email w_member_social",
      });
      const result = await getAccessToken(supabase, "user-1");
      expect(result).toBeNull();
    });

    it("returns token when expires_at is null", async () => {
      const supabase = createMockSupabaseForToken({
        access_token: "token-no-expiry",
        expires_at: null,
        scope: "openid profile email w_member_social",
      });
      const result = await getAccessToken(supabase, "user-1");
      expect(result).not.toBeNull();
      expect(result!.token).toBe("token-no-expiry");
    });

    it("queries the correct table", async () => {
      const supabase = createMockSupabaseForToken(null);
      await getAccessToken(supabase, "user-1");
      expect(supabase.from).toHaveBeenCalledWith("linkedin_connections");
    });

    it("selects only access_token, expires_at, and scope", async () => {
      const supabase = createMockSupabaseForToken(null);
      await getAccessToken(supabase, "user-1");
      const chain = (supabase.from as Mock).mock.results[0]!.value;
      expect(chain.select).toHaveBeenCalledWith("access_token, expires_at, scope");
    });
  });

  describe("upsertConnection", () => {
    it("creates a new connection successfully", async () => {
      const supabase = createMockSupabase();
      const result = await upsertConnection(supabase, {
        profile_id: "user-1", linkedin_sub: "sub-1", access_token: "token",
        expires_at: "2026-12-31T00:00:00Z", scope: "openid", linkedin_name: null, linkedin_email: null,
      });
      expect(result.error).toBeNull();
    });

    it("returns error when upsert fails", async () => {
      const supabase = createMockSupabase({ upsertError: { message: "fk violation" } });
      const result = await upsertConnection(supabase, {
        profile_id: "user-1", linkedin_sub: "sub-1", access_token: "token",
        expires_at: null, scope: "openid", linkedin_name: null, linkedin_email: null,
      });
      expect(result.error).toBe("fk violation");
    });
  });

  describe("deleteConnection", () => {
    it("deletes the connection successfully", async () => {
      const supabase = createMockSupabase();
      const result = await deleteConnection(supabase, "user-1");
      expect(result.error).toBeNull();
    });

    it("returns error when delete fails", async () => {
      const supabase = createMockSupabase({ deleteError: { message: "not found" } });
      const result = await deleteConnection(supabase, "user-1");
      expect(result.error).toBe("not found");
    });
  });
});
