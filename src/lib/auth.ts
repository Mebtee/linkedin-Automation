import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";

import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Sign in",
};

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
