import { describe, it, expect, vi, afterEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));

vi.mock("@/config/env.server", () => ({
  requireServerEnv: vi.fn((key: string) => {
    const vars: Record<string, string> = {
      linkedinClientId: "test-client-id",
      linkedinClientSecret: "test-client-secret",
      linkedinOAuthStateSecret: "test-state-secret",
    };
    const value = vars[key];
    if (!value) throw new Error(`Missing env: ${key}`);
    return value;
  }),
}));

vi.mock("@/config/env", () => ({
  requirePublicEnv: vi.fn((key: string) => {
    const vars: Record<string, string> = {
      appUrl: "http://localhost:3000",
    };
    const value = vars[key];
    if (!value) throw new Error(`Missing env: ${key}`);
    return value;
  }),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import { exchangeCodeForToken, fetchLinkedInUserInfo } from "@/services/linkedin/oauth";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("LinkedIn Token Exchange", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("exchangeCodeForToken", () => {
    it("sends correct parameters to LinkedIn token endpoint", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "test-access-token",
            expires_in: 5184000,
            token_type: "bearer",
            scope: "openid profile email",
          }),
      });
      globalThis.fetch = mockFetch;

      await exchangeCodeForToken("auth-code-123", "http://localhost:3000/api/linkedin/callback");

      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0]!;
      expect(url).toBe("https://www.linkedin.com/oauth/v2/accessToken");
      expect(options.method).toBe("POST");
      expect(options.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");

      const body = new URLSearchParams(options.body);
      expect(body.get("grant_type")).toBe("authorization_code");
      expect(body.get("code")).toBe("auth-code-123");
      expect(body.get("redirect_uri")).toBe("http://localhost:3000/api/linkedin/callback");
      expect(body.get("client_id")).toBe("test-client-id");
      expect(body.get("client_secret")).toBe("test-client-secret");
    });

    it("returns the token response on success", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "my-access-token",
            expires_in: 5184000,
            token_type: "bearer",
            scope: "openid profile email",
          }),
      });

      const result = await exchangeCodeForToken("code-abc", "http://example.com/callback");

      expect(result.access_token).toBe("my-access-token");
      expect(result.expires_in).toBe(5184000);
      expect(result.token_type).toBe("bearer");
      expect(result.scope).toBe("openid profile email");
    });

    it("throws when LinkedIn returns an error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("invalid_grant"),
      });

      await expect(
        exchangeCodeForToken("bad-code", "http://example.com/callback"),
      ).rejects.toThrow("LinkedIn token exchange failed (400)");
    });

    it("throws when network request fails", async () => {
      globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

      await expect(
        exchangeCodeForToken("code-xyz", "http://example.com/callback"),
      ).rejects.toThrow("Network error");
    });
  });

  describe("fetchLinkedInUserInfo", () => {
    it("sends the access token in the Authorization header", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            sub: "linkedin-sub-123",
            name: "John Doe",
            email: "john@example.com",
          }),
      });
      globalThis.fetch = mockFetch;

      await fetchLinkedInUserInfo("my-token");

      const [url, options] = mockFetch.mock.calls[0]!;
      expect(url).toBe("https://api.linkedin.com/v2/userinfo");
      expect(options.headers.Authorization).toBe("Bearer my-token");
    });

    it("returns the user info on success", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            sub: "abc-123",
            name: "Jane Smith",
            email: "jane@example.com",
          }),
      });

      const result = await fetchLinkedInUserInfo("token");

      expect(result.sub).toBe("abc-123");
      expect(result.name).toBe("Jane Smith");
      expect(result.email).toBe("jane@example.com");
    });

    it("handles missing optional fields", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            sub: "abc-456",
          }),
      });

      const result = await fetchLinkedInUserInfo("token");

      expect(result.sub).toBe("abc-456");
      expect(result.name).toBeUndefined();
      expect(result.email).toBeUndefined();
    });

    it("throws when LinkedIn returns an error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("unauthorized"),
      });

      await expect(fetchLinkedInUserInfo("bad-token")).rejects.toThrow(
        "LinkedIn userinfo request failed (401)",
      );
    });
  });
});
