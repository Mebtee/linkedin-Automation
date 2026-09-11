import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/utils/errors";

import { brand } from "@/config/brand";

/**
 * Ensures a profile row exists for the authenticated user.
 * Called once after authentication; idempotent via upsert.
 */
export async function ensureProfile() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Check if profile exists
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (existing) return existing.id;

  // Create profile with default timezone
  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      timezone: brand.timezone,
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("Profile creation failed:", error.message);
    return null;
  }

  return user.id;
}

/**
 * Returns the current user or null if not authenticated.
 * Server-side only.
 */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Asserts the caller is authenticated, returning the user object.
 *
 * Centralised helper shared by service modules that receive a SupabaseClient
 * parameter (e.g. scheduling, ai/generation). Throws `AppError` with the
 * provided code when no session is found.
 *
 * @param supabase - An already-constructed Supabase client.
 * @param message  - Human-readable error message (defaults to "Authentication required.").
 * @param code     - Machine-readable error code (defaults to "AUTH_REQUIRED").
 */
export async function requireAuthWithClient(
  supabase: SupabaseClient,
  message = "Authentication required.",
  code = "AUTH_REQUIRED",
): Promise<{ id: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError(message, { code });
  }

  return user;
}
