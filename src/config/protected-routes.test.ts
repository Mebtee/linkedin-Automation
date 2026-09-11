import { describe, expect, it } from "vitest";

import { AUTH_ROUTES, PROTECTED_ROUTES } from "./protected-routes";

describe("protected-routes", () => {
  it("protects every authenticated workspace route", () => {
    for (const route of [
      "/journal",
      "/course-materials",
      "/posts",
      "/schedule",
      "/settings",
      "/opportunities",
    ]) {
      expect(PROTECTED_ROUTES).toContain(route);
    }
  });

  it("keeps auth routes out of the protected list", () => {
    for (const auth of AUTH_ROUTES) {
      expect(PROTECTED_ROUTES).not.toContain(auth);
    }
  });

  it("matches nested paths (prefix semantics used by middleware)", () => {
    const pathname = "/opportunities/123";
    expect(
      PROTECTED_ROUTES.some((route) => pathname.startsWith(route)),
    ).toBe(true);
  });

  // ─── /dashboard audit (Finding 6) ────────────────────────────────────────
  // Security hardening audit found that src/app/dashboard/ exists as a
  // directory. Confirmed: the directory is EMPTY (no page.tsx, no route.ts).
  // An empty directory does NOT create a Next.js route, so there is no
  // publicly accessible /dashboard route to protect at this time.
  //
  // If a page.tsx is ever added under src/app/dashboard/, it MUST also be
  // added to PROTECTED_ROUTES to prevent unauthenticated access.
  it("does not include /dashboard because no page.tsx exists there (empty directory)", () => {
    // This is intentional: /dashboard has no page file → no route to protect.
    // Remove this test and add /dashboard to PROTECTED_ROUTES if a page is created.
    expect(PROTECTED_ROUTES).not.toContain("/dashboard");
  });
});