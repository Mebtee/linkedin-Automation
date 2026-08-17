import { createServerClient } from "@supabase/ssr";

import type { NextRequest, NextResponse } from "next/server";

/**
 * Supabase client for Next.js middleware.
 *
 * Refreshes the auth session on every request and updates cookies on the
 * response. This is the only client that receives both the request and
 * response objects for cookie manipulation.
 */
export function createClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
}
