import { NextResponse } from "next/server";

import { createWriteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import { brand } from "@/config/brand";
import {
  verifyOAuthState,
  exchangeCodeForToken,
  fetchLinkedInUserInfo,
  upsertConnection,
  resolveLinkedInCallbackRedirectUri,
} from "@/services/linkedin";

export const dynamic = "force-dynamic";

// ─── In-process rate limiter ────────────────────────────────────────────────
// Protects the OAuth callback against rapid-fire attempts that would cause
// repeated token exchanges with LinkedIn's API (which could trigger LinkedIn's
// own rate limits or exhaust the app's client quota).
//
// 10 attempts per IP per 15 minutes is well above the maximum expected rate
// for legitimate OAuth flows (user clicks "Connect" once, then re-tries if
// something goes wrong). Vercel serverless instances are ephemeral; the Map
// resets on cold starts, but that is acceptable for this lightweight guard.

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count++;
  return false;
}

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

  // Apply rate limiting before any processing.
  // The x-forwarded-for header is set by Vercel for all inbound requests.
  const ip =
    (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ||
    "unknown";
  if (isRateLimited(ip)) {
    settingsUrl.searchParams.set("linkedin", "rate_limited");
    return NextResponse.redirect(settingsUrl);
  }

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
    const redirectUri = resolveLinkedInCallbackRedirectUri(request);
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
      { id: user.id, timezone: brand.timezone },
      { onConflict: "id" },
    );

    // Store the LinkedIn connection (upsert for reconnect/reauth support).
    // Runs under the service-role client: the token-privileges hardening
    // migration revokes table-level SELECT from authenticated, and PostgreSQL
    // requires table-level SELECT for `INSERT ... ON CONFLICT` upserts. Using
    // the admin client keeps the "client can never read access_token" property
    // while letting the server persist the connection. Ownership was already
    // verified above (signed state matches the session user).
    const { error: dbError } = await upsertConnection(createAdminClient(), {
      profile_id: user.id,
      linkedin_sub: userInfo.sub,
      access_token: tokenResponse.access_token,
      expires_at: tokenResponse.expires_in > 0 ? expiresAt : null,
      scope: tokenResponse.scope,
      linkedin_name: userInfo.name ?? null,
      linkedin_email: userInfo.email ?? null,
    });

    if (dbError) {
      log.error("linkedin.connection_store_failed", {
        mode: payload.mode,
        profileId: user.id,
        dbError,
      });
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
  } catch {
    log.error("linkedin.callback_failed", { mode: payload.mode });
    settingsUrl.searchParams.set("linkedin", "callback_error");
    return NextResponse.redirect(settingsUrl);
  }
}
