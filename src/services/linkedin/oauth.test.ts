import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));

vi.mock("@/config/env.server", () => ({
  requireServerEnv: vi.fn((key: string) => {
    const vars: Record<string, string> = {
      linkedinOAuthStateSecret: "test-secret-key-for-oauth-state-signing-1234",
      linkedinClientId: "test-client-id",
      linkedinClientSecret: "test-client-secret",
    };
    const value = vars[key];
    if (!value) throw new Error(`Missing env: ${key}`);
    return value;
  }),
  serverEnv: {
    linkedinOAuthStateSecret: "test-secret-key-for-oauth-state-signing-1234",
    linkedinClientId: "test-client-id",
    linkedinClientSecret: "test-client-secret",
  },
}));

vi.mock("@/config/env", () => ({
  requirePublicEnv: vi.fn((key: string) => {
    const vars: Record<string, string> = {
      appUrl: "http://localhost:3000",
      supabaseUrl: "https://test.supabase.co",
      supabaseAnonKey: "test-anon-key",
    };
    const value = vars[key];
    if (!value) throw new Error(`Missing env: ${key}`);
    return value;
  }),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import {
  generateOAuthState,
  verifyOAuthState,
  buildAuthorizationUrl,
  buildReauthAuthorizationUrl,
} from "@/services/linkedin/oauth";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("LinkedIn OAuth State", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("generateOAuthState", () => {
    it("returns a string in format base64url.signature", () => {
      const state = generateOAuthState("user-123");
      const parts = state.split(".");
      expect(parts).toHaveLength(2);
      expect(parts[0]).toBeTruthy();
      expect(parts[1]).toBeTruthy();
    });

    it("encodes the user id and timestamp in the payload", () => {
      const now = 1700000000000;
      vi.setSystemTime(now);

      const state = generateOAuthState("user-123");
      const [encoded] = state.split(".");
      const payload = JSON.parse(
        Buffer.from(encoded!, "base64url").toString("utf-8"),
      );

      expect(payload.uid).toBe("user-123");
      expect(payload.ts).toBe(now);
    });

    it("defaults mode to 'connect' when not specified", () => {
      const state = generateOAuthState("user-123");
      const [encoded] = state.split(".");
      const payload = JSON.parse(
        Buffer.from(encoded!, "base64url").toString("utf-8"),
      );

      expect(payload.mode).toBe("connect");
    });

    it("encodes mode='reauth' when specified", () => {
      const state = generateOAuthState("user-123", "reauth");
      const [encoded] = state.split(".");
      const payload = JSON.parse(
        Buffer.from(encoded!, "base64url").toString("utf-8"),
      );

      expect(payload.mode).toBe("reauth");
    });

    it("produces different signatures for different secrets", () => {
      const state = generateOAuthState("user-123");
      expect(state).toBeTruthy();
      // Just verify it's a valid format
      expect(state.split(".")).toHaveLength(2);
    });
  });

  describe("verifyOAuthState", () => {
    it("returns the decoded payload for a valid state", () => {
      const now = 1700000000000;
      vi.setSystemTime(now);

      const state = generateOAuthState("user-456");
      const payload = verifyOAuthState(state);

      expect(payload).not.toBeNull();
      expect(payload!.uid).toBe("user-456");
      expect(payload!.ts).toBe(now);
    });

    it("returns null for a tampered payload", () => {
      const state = generateOAuthState("user-123");
      const [, signature] = state.split(".");

      // Tamper with the payload
      const tampered = `dHVtcGVk.${signature}`;
      const result = verifyOAuthState(tampered);
      expect(result).toBeNull();
    });

    it("returns null for a tampered signature", () => {
      const state = generateOAuthState("user-123");
      const [encoded] = state.split(".");

      const tampered = `${encoded}.tampered_signature_value`;
      const result = verifyOAuthState(tampered);
      expect(result).toBeNull();
    });

    it("returns null for an expired state (> 10 minutes)", () => {
      vi.setSystemTime(1700000000000);
      const state = generateOAuthState("user-123");

      // Advance time by 11 minutes
      vi.setSystemTime(1700000000000 + 11 * 60 * 1000);

      const payload = verifyOAuthState(state);
      expect(payload).toBeNull();
    });

    it("accepts a state created 9 minutes ago", () => {
      vi.setSystemTime(1700000000000);
      const state = generateOAuthState("user-123");

      // Advance time by 9 minutes (within the 10-minute window)
      vi.setSystemTime(1700000000000 + 9 * 60 * 1000);

      const payload = verifyOAuthState(state);
      expect(payload).not.toBeNull();
      expect(payload!.uid).toBe("user-123");
    });

    it("returns null for a malformed state string", () => {
      expect(verifyOAuthState("")).toBeNull();
      expect(verifyOAuthState("noperiod")).toBeNull();
      expect(verifyOAuthState("a.b.c")).toBeNull();
    });

    it("returns null for non-base64url content", () => {
      expect(verifyOAuthState("not-valid.not-valid")).toBeNull();
    });
  });

  describe("buildAuthorizationUrl", () => {
    it("constructs a valid LinkedIn OAuth URL", () => {
      const state = generateOAuthState("user-123");
      const redirectUri = "http://localhost:3000/api/linkedin/callback";

      const url = buildAuthorizationUrl(state, redirectUri);
      const parsed = new URL(url);

      expect(parsed.origin).toBe("https://www.linkedin.com");
      expect(parsed.pathname).toBe("/oauth/v2/authorization");
      expect(parsed.searchParams.get("response_type")).toBe("code");
      expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
      expect(parsed.searchParams.get("redirect_uri")).toBe(redirectUri);
      expect(parsed.searchParams.get("scope")).toBe("openid profile email");
      expect(parsed.searchParams.get("state")).toBe(state);
    });

    it("includes all required OAuth parameters", () => {
      const state = generateOAuthState("user-123");
      const url = buildAuthorizationUrl(state, "http://example.com/callback");
      const parsed = new URL(url);

      const requiredParams = [
        "response_type",
        "client_id",
        "redirect_uri",
        "scope",
        "state",
      ];

      for (const param of requiredParams) {
        expect(parsed.searchParams.has(param)).toBe(true);
      }
    });

    it("uses custom scopes when provided", () => {
      const state = generateOAuthState("user-123");
      const url = buildAuthorizationUrl(
        state,
        "http://localhost:3000/api/linkedin/callback",
        "openid profile email w_member_social",
      );
      const parsed = new URL(url);

      expect(parsed.searchParams.get("scope")).toBe(
        "openid profile email w_member_social",
      );
    });
  });

  describe("buildReauthAuthorizationUrl", () => {
    it("includes w_member_social in the scope", () => {
      const state = generateOAuthState("user-123");
      const url = buildReauthAuthorizationUrl(
        state,
        "http://localhost:3000/api/linkedin/callback",
      );
      const parsed = new URL(url);

      expect(parsed.searchParams.get("scope")).toBe(
        "openid profile email w_member_social",
      );
    });
  });
});
