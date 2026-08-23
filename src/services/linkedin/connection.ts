import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { LinkedInConnectionStatus } from "@/types/linkedin";

// ─── Types ──────────────────────────────────────────────────────────────────

export type LinkedInConnectionInfo = {
  readonly status: LinkedInConnectionStatus;
  readonly connected_at: string | null;
  readonly linkedin_name: string | null;
  readonly linkedin_email: string | null;
};

// ─── Status ─────────────────────────────────────────────────────────────────

/**
 * Returns the connection info for the authenticated user, including computed
 * status (connected / expired / disconnected).
 */
export async function getConnectionStatus(
  supabase: SupabaseClient,
  profileId: string,
): Promise<LinkedInConnectionInfo> {
  const { data } = await supabase
    .from("linkedin_connections")
    .select("expires_at, linkedin_name, linkedin_email, created_at")
    .eq("profile_id", profileId)
    .single();

  if (!data) {
    return { status: "disconnected", connected_at: null, linkedin_name: null, linkedin_email: null };
  }

  const isExpired =
    data.expires_at !== null && new Date(data.expires_at) < new Date();

  return {
    status: isExpired ? "expired" : "connected",
    connected_at: data.created_at,
    linkedin_name: data.linkedin_name,
    linkedin_email: data.linkedin_email,
  };
}

// ─── Access Token Retrieval ────────────────────────────────────────────────

export type AccessTokenInfo = {
  readonly token: string;
  readonly hasPublishScope: boolean;
  /** OpenID Connect subject (LinkedIn member id) used to build the author URN. */
  readonly linkedinSub: string;
};

/**
 * Retrieves the raw LinkedIn access token for a user. Server-side only.
 * Never returns the token to client code.
 *
 * Returns null if no connection exists, the token is expired, or the
 * connection lacks the required `w_member_social` scope.
 */
export async function getAccessToken(
  supabase: SupabaseClient,
  profileId: string,
): Promise<AccessTokenInfo | null> {
  const { data } = await supabase
    .from("linkedin_connections")
    .select("access_token, linkedin_sub, expires_at, scope")
    .eq("profile_id", profileId)
    .single();

  if (!data) return null;

  // Check expiry
  if (data.expires_at !== null && new Date(data.expires_at) < new Date()) {
    return null;
  }

  const hasPublishScope = data.scope.includes("w_member_social");

  return { token: data.access_token, hasPublishScope, linkedinSub: data.linkedin_sub };
}

/**
 * Builds the LinkedIn member URN (`urn:li:person:<sub>`) required as the
 * post `author`. Must come from the stored OpenID Connect subject — using an
 * internal UUID would be rejected by the API.
 */
export function buildMemberUrn(linkedinSub: string): string {
  return `urn:li:person:${linkedinSub}`;
}

// ─── Upsert ─────────────────────────────────────────────────────────────────

export type UpsertConnectionInput = {
  readonly profile_id: string;
  readonly linkedin_sub: string;
  readonly access_token: string;
  readonly expires_at: string | null;
  readonly scope: string;
  readonly linkedin_name: string | null;
  readonly linkedin_email: string | null;
};

/**
 * Creates or updates the LinkedIn connection for a user (reconnect/upsert).
 * Uses profile_id as the conflict key (one connection per user).
 */
export async function upsertConnection(
  supabase: SupabaseClient,
  input: UpsertConnectionInput,
): Promise<{ readonly error: string | null }> {
  const { error } = await supabase.from("linkedin_connections").upsert(
    {
      profile_id: input.profile_id,
      linkedin_sub: input.linkedin_sub,
      access_token: input.access_token,
      token_type: "bearer",
      expires_at: input.expires_at,
      scope: input.scope,
      linkedin_name: input.linkedin_name,
      linkedin_email: input.linkedin_email,
    },
    { onConflict: "profile_id" },
  );

  return { error: error?.message ?? null };
}

// ─── Disconnect ─────────────────────────────────────────────────────────────

/**
 * Removes the LinkedIn connection for a user.
 */
export async function deleteConnection(
  supabase: SupabaseClient,
  profileId: string,
): Promise<{ readonly error: string | null }> {
  const { error } = await supabase
    .from("linkedin_connections")
    .delete()
    .eq("profile_id", profileId);

  return { error: error?.message ?? null };
}
