import { NextResponse } from "next/server";

import { requirePublicEnv } from "@/config/env";
import { createWriteClient } from "@/lib/supabase/server";
import {
  verifyOAuthState,
  exchangeCodeForToken,
  fetchLinkedInUserInfo,
  upsertConnection,
} from "@/services/linkedin";

export const dynamic = "force-dynamic";

/**
 * GET /api/linkedin/callback?code=...&state=...
 *
 * Handles the LinkedIn OAuth 2.0 callback. Verifies the signed state (CSRF
 * protection), exchanges the authorization code for tokens, fetches the
 * user's LinkedIn profile, and stores the connection in the database.
 *
 * Supports two modes via the state payload:
 * - connect: Initial connection (Phase 3G-A)
 * - reauth: Reauthorization for w_member_social scope (Phase 3G-B)
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const settingsUrl = new URL(`${origin}/settings`);

  // LinkedIn returned an error (e.g. user denied access)
  if (error) {
    settingsUrl.searchParams.set("linkedin", "denied");
    return NextResponse.redirect(settingsUrl);
  }

  if (!code || !state) {
    settingsUrl.searchParams.set("linkedin", "missing_params");
    return NextResponse.redirect(settingsUrl);
  }

  // Verify the signed state (CSRF protection)
  const payload = verifyOAuthState(state);
  if (!payload) {
    settingsUrl.searchParams.set("linkedin", "invalid_state");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    // Exchange the authorization code for tokens
    const redirectUri = `${requirePublicEnv("appUrl")}/api/linkedin/callback`;
    const tokenResponse = await exchangeCodeForToken(code, redirectUri);

    // Fetch the user's LinkedIn profile info
    const userInfo = await fetchLinkedInUserInfo(tokenResponse.access_token);

    // Calculate token expiry
    const expiresAt = new Date(
      Date.now() + tokenResponse.expires_in * 1000,
    ).toISOString();

    // Verify the Supabase session matches the state's uid
    const supabase = await createWriteClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.id !== payload.uid) {
      settingsUrl.searchParams.set("linkedin", "session_mismatch");
      return NextResponse.redirect(settingsUrl);
    }

    // Ensure profile exists
    await supabase.from("profiles").upsert(
      { id: user.id, timezone: "Africa/Addis_Ababa" },
      { onConflict: "id" },
    );

    // Store the LinkedIn connection (upsert for reconnect/reauth support)
    const { error: dbError } = await upsertConnection(supabase, {
      profile_id: user.id,
      linkedin_sub: userInfo.sub,
      access_token: tokenResponse.access_token,
      expires_at: tokenResponse.expires_in > 0 ? expiresAt : null,
      scope: tokenResponse.scope,
      linkedin_name: userInfo.name ?? null,
      linkedin_email: userInfo.email ?? null,
    });

    if (dbError) {
      console.error("Failed to store LinkedIn connection:", dbError);
      settingsUrl.searchParams.set("linkedin", "db_error");
      return NextResponse.redirect(settingsUrl);
    }

    // Signal the appropriate result based on mode
    if (payload.mode === "reauth") {
      settingsUrl.searchParams.set("linkedin", "reauthorized");
    } else {
      settingsUrl.searchParams.set("linkedin", "connected");
    }
    return NextResponse.redirect(settingsUrl);
  } catch (error) {
    console.error("LinkedIn callback processing failed:", error);
    settingsUrl.searchParams.set("linkedin", "callback_error");
    return NextResponse.redirect(settingsUrl);
  }
}
