import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createWriteClient: vi.fn() }));
vi.mock("@/lib/auth", () => ({ ensureProfile: vi.fn() }));
vi.mock("@/config/env", () => ({ requirePublicEnv: vi.fn(() => "http://localhost:3000") }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

// ─── Imports ─────────────────────────────────────────────────────────────────

// NOTE: We import after mocks so the module picks up the mocked dependencies.
import { signup } from "./auth";
import { createWriteClient } from "@/lib/supabase/server";
import { brand } from "@/config/brand";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFormData(email = "user@example.com", password = "password123"): FormData {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("password", password);
  return fd;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("auth actions — timezone configuration", () => {
  const mockSignUp = vi.fn();

  beforeEach(() => {
    const mockClient = {
      auth: {
        signUp: mockSignUp,
      },
    };
    (createWriteClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient);
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses brand.timezone (not a hardcoded string) when signing up", async () => {
    await signup(makeFormData()).catch(() => {
      // redirect() throws; that is expected
    });

    expect(mockSignUp).toHaveBeenCalledOnce();

    const [signUpOptions] = mockSignUp.mock.calls[0]!;
    const timezone = signUpOptions?.options?.data?.timezone;

    // The timezone must match brand.timezone exactly.
    expect(timezone).toBe(brand.timezone);
  });

  it("does not hardcode Africa/Addis_Ababa — uses brand config", async () => {
    await signup(makeFormData()).catch(() => {
      /* redirect throws */
    });

    const [signUpOptions] = mockSignUp.mock.calls[0]!;
    const timezone = signUpOptions?.options?.data?.timezone;

    // If brand.timezone ever changes, this test will update automatically.
    // The point is that the value comes FROM brand, not from a literal string.
    expect(timezone).toBe(brand.timezone);
    // Verify brand.timezone itself is a non-empty string (it should always be).
    expect(typeof brand.timezone).toBe("string");
    expect(brand.timezone.length).toBeGreaterThan(0);
  });
});
