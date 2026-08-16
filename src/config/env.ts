import { assertNonEmptyString } from "@/services/validation";

/**
 * Public (client-safe) environment variables.
 *
 * Only `NEXT_PUBLIC_*` variables belong here. They are safe to read from
 * client components because Next.js inlines them into the client bundle at
 * build time. Never add secrets to this module — anything prefixed
 * `NEXT_PUBLIC_` is shipped to the browser.
 *
 * Access each value via the literal `process.env.NEXT_PUBLIC_*` member above
 * so Next.js can statically inline it for client usage.
 */
export const PUBLIC_ENV_VARS = {
  appUrl: "NEXT_PUBLIC_APP_URL",
  supabaseUrl: "NEXT_PUBLIC_SUPABASE_URL",
  supabaseAnonKey: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
} as const;

export type PublicEnvKey = keyof typeof PUBLIC_ENV_VARS;

export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
} as const;

/**
 * Returns a public variable, throwing a clear error when it is missing.
 * Call this from the module that genuinely needs the value; do not rely on
 * silently undefined values.
 */
export function requirePublicEnv(key: PublicEnvKey): string {
  return assertNonEmptyString(
    publicEnv[key],
    `Missing required environment variable "${PUBLIC_ENV_VARS[key]}". Add it to .env.local.`,
    "MISSING_ENV_VAR",
  );
}
