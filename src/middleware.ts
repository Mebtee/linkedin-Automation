import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/middleware";
import { AUTH_ROUTES, PROTECTED_ROUTES } from "@/config/protected-routes";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const supabase = createClient(request, response);

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
     * Match all request paths except:
     * - _next/static, _next/image, favicon.ico (static files)
     * - api/health (public health endpoint)
     * - public/ (static assets)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
