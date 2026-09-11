import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────
// All external dependencies of the callback route must be mocked before the
// route module is imported so we control what it calls.

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({ createWriteClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/logger", () => ({ log: { error: vi.fn() } }));
vi.mock("@/config/brand", () => ({ brand: { timezone: "Africa/Addis_Ababa" } }));

vi.mock("@/services/linkedin", () => ({
  verifyOAuthState: vi.fn(),
  exchangeCodeForToken: vi.fn(),
  fetchLinkedInUserInfo: vi.fn(),
  upsertConnection: vi.fn(),
  resolveLinkedInCallbackRedirectUri: vi.fn(),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import { GET } from "./route";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(ip: string, params = "code=abc&state=xyz"): Request {
  return new Request("http://localhost/api/linkedin/callback?" + params, {
    headers: { "x-forwarded-for": ip },
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("LinkedIn OAuth callback — rate limiter (Finding 8)", () => {
  // Force a unique IP for each test so rate limit state doesn't bleed between tests.
  let testIp: string;

  beforeEach(() => {
    // Use a unique IP per test run so the module-level Map doesn't accumulate
    // between tests (the Map lives for the lifetime of the module import).
    testIp = "10.0." + Math.floor(Math.random() * 255) + "." + Math.floor(Math.random() * 255);
  });

  it("allows requests below the rate limit", async () => {
    const response = await GET(makeRequest(testIp));
    // Any redirect other than rate_limited is acceptable (the state will be
    // invalid because verifyOAuthState is mocked to return undefined).
    const location = response.headers.get("location") ?? "";
    expect(location).not.toContain("rate_limited");
  });

  it("rejects the 11th request from the same IP within the window", async () => {
    // Issue 10 requests (all below the limit of 10).
    for (let i = 0; i < 10; i++) {
      await GET(makeRequest(testIp));
    }

    // The 11th request must be rate-limited.
    const response = await GET(makeRequest(testIp));
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("rate_limited");
  });

  it("does not rate-limit different IPs independently", async () => {
    const ip1 = "192.168.1." + Math.floor(Math.random() * 255);
    const ip2 = "192.168.2." + Math.floor(Math.random() * 255);

    // Exhaust ip1's limit.
    for (let i = 0; i < 11; i++) {
      await GET(makeRequest(ip1));
    }

    // ip2 should still be allowed.
    const response = await GET(makeRequest(ip2));
    const location = response.headers.get("location") ?? "";
    expect(location).not.toContain("rate_limited");
  });

  it("a legitimate request within the limit reaches state verification (not rate limited)", async () => {
    const { verifyOAuthState } = await import("@/services/linkedin");
    (verifyOAuthState as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

    const response = await GET(makeRequest(testIp));
    const location = response.headers.get("location") ?? "";

    // invalid_state means it got past the rate limiter and hit state validation.
    expect(location).toContain("invalid_state");
    expect(location).not.toContain("rate_limited");
  });
});
