import { createBrowserClient } from "@supabase/ssr";

import { requirePublicEnv } from "@/config/env";

let client: ReturnType<typeof createBrowserClient> | undefined;

/**
 * Supabase client for browser / client-component usage.
 *
 * Uses the public anon key only — safe to ship to the browser.
 * Returns a singleton to avoid creating multiple connections during HMR.
 */
export function createClient() {
  if (client) return client;

  client = createBrowserClient(
    requirePublicEnv("supabaseUrl"),
    requirePublicEnv("supabaseAnonKey"),
  );

  return client;
}
