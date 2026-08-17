import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { requirePublicEnv } from "@/config/env";

/**
 * Supabase client for Server Components (read-only cookie access).
 *
 * This client reads the auth session from cookies but cannot modify them.
 * Use `createWriteClient` in Route Handlers / Server Actions when you need
 * to set or clear cookies (e.g. after sign-in / sign-out).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requirePublicEnv("supabaseUrl"),
    requirePublicEnv("supabaseAnonKey"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server Components are read-only — cookie writes are a no-op here.
          // Use createWriteClient in Route Handlers / Server Actions instead.
        },
      },
    },
  );
}
