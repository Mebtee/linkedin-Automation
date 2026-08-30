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
});