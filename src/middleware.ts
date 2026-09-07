import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/middleware";
import { AUTH_ROUTES, PROTECTED_ROUTES } from "@/config/protected-routes";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Guard: if Supabase is slow or unreachable, don't hang the middleware.
  // Treat the user as unauthenticated and let page-level auth handle retries.
  let user = null;
  try {
    const supabase = createClient(request, response);
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Network failure or Supabase timeout — fail open so the request proceeds.
    // The page/API layer will re-validate auth independently.
    return response;
  }

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
