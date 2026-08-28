import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));

const mockAppUrl = vi.fn<() => string | undefined>();

vi.mock("@/config/env", () => ({
  publicEnv: {
    get appUrl() {
      return mockAppUrl();
    },
  },
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import { resolveLinkedInCallbackRedirectUri } from "@/services/linkedin/redirect";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const LOCAL_REQUEST = new Request(
  "http://localhost:3000/api/linkedin/auth?mode=connect",
);

const PRODUCTION_REQUEST = new Request(
  "https://linkedin-automation-delta-seven.vercel.app/api/linkedin/auth?mode=connect",
);

const PRODUCTION_BASE_URL = "https://linkedin-automation-delta-seven.vercel.app";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("resolveLinkedInCallbackRedirectUri", () => {
  beforeEach(() => {
    mockAppUrl.mockReset();
  });

  describe("when NEXT_PUBLIC_APP_URL is configured", () => {
    it("resolves the local development redirect URI", () => {
      mockAppUrl.mockReturnValue("http://localhost:3000");

      expect(resolveLinkedInCallbackRedirectUri(LOCAL_REQUEST)).toBe(
        "http://localhost:3000/api/linkedin/callback",
      );
    });

    it("resolves the production redirect URI from the env value", () => {
      mockAppUrl.mockReturnValue(PRODUCTION_BASE_URL);

      expect(resolveLinkedInCallbackRedirectUri(PRODUCTION_REQUEST)).toBe(
        `${PRODUCTION_BASE_URL}/api/linkedin/callback`,
      );
    });

    it("ignores the request origin when env is configured (custom domain case)", () => {
      mockAppUrl.mockReturnValue("https://custom-domain.example");

      const requestOnVercelDomain = new Request(
        `${PRODUCTION_BASE_URL}/api/linkedin/auth`,
      );

      expect(resolveLinkedInCallbackRedirectUri(requestOnVercelDomain)).toBe(
        "https://custom-domain.example/api/linkedin/callback",
      );
    });

    it("strips a trailing slash from the configured base URL", () => {
      mockAppUrl.mockReturnValue(`${PRODUCTION_BASE_URL}/`);

      expect(resolveLinkedInCallbackRedirectUri(PRODUCTION_REQUEST)).toBe(
        `${PRODUCTION_BASE_URL}/api/linkedin/callback`,
      );
    });

    it("treats a whitespace-only value as unconfigured", () => {
      mockAppUrl.mockReturnValue("   " as string);

      expect(resolveLinkedInCallbackRedirectUri(PRODUCTION_REQUEST)).toBe(
        `${PRODUCTION_BASE_URL}/api/linkedin/callback`,
      );
    });
  });

  describe("when NEXT_PUBLIC_APP_URL is unset (fallback to request origin)", () => {
    it("falls back to localhost origin during local development", () => {
      mockAppUrl.mockReturnValue(undefined);

      expect(resolveLinkedInCallbackRedirectUri(LOCAL_REQUEST)).toBe(
        "http://localhost:3000/api/linkedin/callback",
      );
    });

    it("falls back to the deployed origin in production", () => {
      mockAppUrl.mockReturnValue(undefined);

      expect(resolveLinkedInCallbackRedirectUri(PRODUCTION_REQUEST)).toBe(
        `${PRODUCTION_BASE_URL}/api/linkedin/callback`,
      );
    });
  });

  describe("same redirect_uri across both OAuth steps", () => {
    it("produces an identical URI for the auth and callback requests of one environment", () => {
      // A single session hits /api/linkedin/auth first, then
      // /api/linkedin/callback. Both must share the exact same redirect_uri
      // so LinkedIn's token endpoint matches the URL it redirected the
      // browser to during the authorization step.
      mockAppUrl.mockReturnValue(PRODUCTION_BASE_URL);

      const authRequest = new Request(
        `${PRODUCTION_BASE_URL}/api/linkedin/auth?mode=connect`,
      );
      const callbackRequest = new Request(
        `${PRODUCTION_BASE_URL}/api/linkedin/callback?code=c&state=s`,
      );

      const authStepUri = resolveLinkedInCallbackRedirectUri(authRequest);
      const exchangeStepUri = resolveLinkedInCallbackRedirectUri(
        callbackRequest,
      );

      expect(authStepUri).toBe(
        `${PRODUCTION_BASE_URL}/api/linkedin/callback`,
      );
      expect(exchangeStepUri).toBe(authStepUri);
    });
  });
});