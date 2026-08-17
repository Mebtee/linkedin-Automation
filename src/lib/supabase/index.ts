export { createClient } from "./client";
export { createAdminClient } from "./admin";

/**
 * Server-side clients are imported directly to avoid ambiguity:
 *
 *   import { createClient } from "@/lib/supabase/server";
 *   import { createWriteClient } from "@/lib/supabase/server";
 */
