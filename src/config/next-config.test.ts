import { describe, it, expect } from "vitest";
import { resolve } from "path";

// ─── Tests ──────────────────────────────────────────────────────────────────

/**
 * Security headers configuration tests (Finding 10).
 *
 * next.config.ts lives at the project root (outside src/), so we import it
 * via an absolute path. The tests validate the config values that Next.js will
 * apply — the runtime delivery of headers is Next.js's responsibility.
 */
describe("next.config.ts — security headers (Finding 10)", () => {
  async function loadConfig() {
    const configPath = resolve(__dirname, "../../next.config.ts");
    // Vitest transpiles TypeScript files on import, so a direct import works.
    const mod = await import(configPath);
    return mod.default as import("next").NextConfig;
  }

  it("exports a headers() function", async () => {
    const config = await loadConfig();
    expect(typeof config.headers).toBe("function");
  });

  it("includes X-Frame-Options: DENY", async () => {
    const config = await loadConfig();
    const rules = await config.headers!();
    const headers = rules.flatMap((r) => r.headers);
    const xfo = headers.find((h) => h.key === "X-Frame-Options");
    expect(xfo).toBeDefined();
    expect(xfo!.value).toBe("DENY");
  });

  it("includes X-Content-Type-Options: nosniff", async () => {
    const config = await loadConfig();
    const rules = await config.headers!();
    const headers = rules.flatMap((r) => r.headers);
    const xcto = headers.find((h) => h.key === "X-Content-Type-Options");
    expect(xcto).toBeDefined();
    expect(xcto!.value).toBe("nosniff");
  });

  it("includes Referrer-Policy: strict-origin-when-cross-origin", async () => {
    const config = await loadConfig();
    const rules = await config.headers!();
    const headers = rules.flatMap((r) => r.headers);
    const rp = headers.find((h) => h.key === "Referrer-Policy");
    expect(rp).toBeDefined();
    expect(rp!.value).toBe("strict-origin-when-cross-origin");
  });

  it("includes Permissions-Policy restricting camera, microphone, geolocation", async () => {
    const config = await loadConfig();
    const rules = await config.headers!();
    const headers = rules.flatMap((r) => r.headers);
    const pp = headers.find((h) => h.key === "Permissions-Policy");
    expect(pp).toBeDefined();
    expect(pp!.value).toContain("camera=()");
    expect(pp!.value).toContain("microphone=()");
    expect(pp!.value).toContain("geolocation=()");
  });

  it("does NOT include Content-Security-Policy (intentionally deferred)", async () => {
    const config = await loadConfig();
    const rules = await config.headers!();
    const headers = rules.flatMap((r) => r.headers);
    const csp = headers.find((h) => h.key === "Content-Security-Policy");
    // CSP requires nonce-based architecture for Next.js; intentionally omitted.
    expect(csp).toBeUndefined();
  });

  it("applies headers to all routes (catch-all source pattern)", async () => {
    const config = await loadConfig();
    const rules = await config.headers!();
    const hasGlobalRule = rules.some(
      (r) => r.source === "/(.*)" || r.source === "/:path*",
    );
    expect(hasGlobalRule).toBe(true);
  });
});
