import { type NextRequest, NextResponse } from "next/server";

import { AUTH_ROUTES, PROTECTED_ROUTES } from "@/config/protected-routes";

/**
 * Lightweight auth check: read the Supabase session cookie directly.
 *
 * Why NOT use supabase.auth.getSession() here:
 * - Even getSession() initialises @supabase/ssr, which can trigger a token
 *   refresh HTTP call when the access token is expired. That network round-
 *   trip to the Supabase auth server is the root cause of
 *   MIDDLEWARE_INVOCATION_TIMEOUT on Vercel Edge (1 500 ms wall-clock limit).
 *
 * Reading the raw cookie is instantaneous (no I/O) and sufficient for
 * routing decisions. The actual token validity is verified server-side in
 * Server Components and Route Handlers via supabase.auth.getUser().
 */
function getSessionFromCookies(request: NextRequest): boolean {
  // Supabase stores the session under one of two cookie name patterns:
  //   sb-<project-ref>-auth-token          (newer @supabase/ssr)
  //   sb-<project-ref>-auth-token.0 / .1   (chunked for large JWTs)
  // We only need to know if ANY such cookie is present and non-empty.
  const cookies = request.cookies.getAll();
  return cookies.some(
    ({ name, value }) =>
      name.includes("-auth-token") && value.length > 0,
  );
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLoggedIn = getSessionFromCookies(request);

  // Redirect unauthenticated users away from protected routes
  if (!isLoggedIn && PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth routes
  if (isLoggedIn && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL("/opportunities", request.url));
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    /*
     * Only run middleware on page routes that need auth protection.
     * Exclude:
     * - /api/* routes (they handle their own auth)
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico and common static file extensions
     * - /public/ assets
     */
    "/((?!api/|_next/static|_next/image|favicon.ico|public/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|ttf|woff|woff2)$).*)",
  ],
};
