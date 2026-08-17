import "server-only";

import { assertNonEmptyString } from "@/services/validation";

/**
 * Server-only environment variables (secrets and server credentials).
 *
 * This module imports "server-only": importing it from a client component
 * fails the build. Secrets here are never inlined into the browser bundle.
 */
const SERVER_ENV_VARS = {
  supabaseServiceRoleKey: "SUPABASE_SERVICE_ROLE_KEY",
  aiTextProvider: "AI_TEXT_PROVIDER",
} as const;

export type ServerEnvKey = keyof typeof SERVER_ENV_VARS;

function read(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? undefined : value;
}

export const serverEnv = {
  supabaseServiceRoleKey: read(SERVER_ENV_VARS.supabaseServiceRoleKey),
  aiTextProvider: read(SERVER_ENV_VARS.aiTextProvider),
} as const;

/**
 * Returns a server-only variable, throwing a clear server-side error when it
 * is missing. Call this from the operation that needs the secret; never let
 * undefined values pass silently.
 */
export function requireServerEnv(key: ServerEnvKey): string {
  return assertNonEmptyString(
    serverEnv[key],
    `Missing required server environment variable "${SERVER_ENV_VARS[key]}". Add it to .env.local.`,
    "MISSING_ENV_VAR",
  );
}
