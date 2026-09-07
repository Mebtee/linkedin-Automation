import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/middleware";
import { AUTH_ROUTES, PROTECTED_ROUTES } from "@/config/protected-routes";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Use getSession() instead of getUser() — getSession() reads the JWT from
  // the cookie with no network call, keeping middleware under the Vercel Edge
  // 1500 ms wall-clock limit. getUser() makes a live HTTP call to Supabase's
  // auth server on every request and is the primary cause of
  // MIDDLEWARE_INVOCATION_TIMEOUT. Security-sensitive checks (e.g. verifying
  // the token hasn't been revoked) should be done in Server Components or
  // API Route Handlers via getUser(), not here.
  const supabase = createClient(request, response);
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const pathname = request.nextUrl.pathname;

  // Redirect unauthenticated users away from protected routes
  if (!user && PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth routes
  if (user && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL("/opportunities", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Only run middleware on page routes that need auth protection.
     * Exclude:
     * - /api/* routes (they handle their own auth — running getUser() on
     *   every API call wastes Edge runtime time and causes MIDDLEWARE_INVOCATION_TIMEOUT)
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico and common static file extensions
     * - /public/ assets
     */
    "/((?!api/|_next/static|_next/image|favicon.ico|public/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|ttf|woff|woff2)$).*)",
  ],
};
