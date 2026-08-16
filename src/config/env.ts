import { assertNonEmptyString } from "@/services/validation";

/**
 * Central access point for environment variables.
 *
 * No variables are required yet. Later phases introduce required variables
 * (Supabase, LinkedIn API, AI provider); call `env.require(...)` from the
 * modules that need them so the application fails fast when they are missing.
 */
export const env = {
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV === "development",

  /** Returns an optional environment variable (never throws). */
  get(name: string): string | undefined {
    const value = process.env[name];
    return value === undefined || value.trim() === "" ? undefined : value;
  },

  /** Returns a required environment variable, throwing when missing or empty. */
  require(name: string): string {
    return assertNonEmptyString(
      env.get(name),
      `Missing required environment variable "${name}".`,
      "MISSING_ENV_VAR",
    );
  },
};
