import "server-only";

import { createClient } from "@supabase/supabase-js";

import { requirePublicEnv } from "@/config/env";
import { requireServerEnv } from "@/config/env.server";

/**
 * Privileged Supabase client using the service-role key.
 *
 * This client bypasses Row-Level Security (RLS). Use only for trusted
 * server-side operations such as background jobs, migrations, admin tasks,
 * or health checks. **Never** expose this client to the browser.
 */
export function createAdminClient() {
  return createClient(
    requirePublicEnv("supabaseUrl"),
    requireServerEnv("supabaseServiceRoleKey"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
