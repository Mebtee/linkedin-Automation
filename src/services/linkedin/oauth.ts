import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

import { requireServerEnv } from "@/config/env.server";

import type { OAuthStatePayload, OAuthStateMode, LinkedInTokenResponse, LinkedInUserInfo } from "@/types/linkedin";

// ─── Constants ──────────────────────────────────────────────────────────────

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

const OAUTH_SCOPES = "openid profile email";
const PUBLISH_SCOPES = "openid profile email w_member_social";

/** State tokens older than 10 minutes are rejected. */
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

// ─── State Generation & Verification ────────────────────────────────────────

/**
 * Generates a signed OAuth state parameter containing the user's ID and a
 * timestamp. The signature prevents tampering; the timestamp prevents replay.
 */
export function generateOAuthState(uid: string, mode: OAuthStateMode = "connect"): string {
  const secret = requireServerEnv("linkedinOAuthStateSecret");
  const payload: OAuthStatePayload = { uid, ts: Date.now(), mode };

  const data = JSON.stringify(payload);
  const encoded = Buffer.from(data, "utf-8").toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");

  return `${encoded}.${signature}`;
}

/**
 * Verifies the signed OAuth state parameter. Returns the decoded payload
 * when valid, or null when the signature is invalid or the state has expired.
 */
export function verifyOAuthState(state: string): OAuthStatePayload | null {
  const secret = requireServerEnv("linkedinOAuthStateSecret");
  const [encoded, signature] = state.split(".");

  if (!encoded || !signature) return null;

  const expectedSig = createHmac("sha256", secret).update(encoded).digest("base64url");

  // Timing-safe comparison to prevent timing attacks
  const sigBuf = Buffer.from(signature, "base64url");
  const expectedBuf = Buffer.from(expectedSig, "base64url");

  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const data = Buffer.from(encoded, "base64url").toString("utf-8");
    const payload: OAuthStatePayload = JSON.parse(data) as OAuthStatePayload;

    // Reject if expired
    if (Date.now() - payload.ts > STATE_MAX_AGE_MS) return null;

    return payload;
  } catch {
    return null;
  }
}

// ─── Authorization URL ──────────────────────────────────────────────────────

/**
 * Builds the LinkedIn OAuth 2.0 authorization URL with the signed state.
 */
export function buildAuthorizationUrl(
  state: string,
  redirectUri: string,
  scopes?: string,
): string {
  const clientId = requireServerEnv("linkedinClientId");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes ?? OAUTH_SCOPES,
    state,
  });

  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

/**
 * Builds the authorization URL for reauthorization with publishing scope.
 */
export function buildReauthAuthorizationUrl(state: string, redirectUri: string): string {
  return buildAuthorizationUrl(state, redirectUri, PUBLISH_SCOPES);
}

// ─── Token Exchange ─────────────────────────────────────────────────────────

/**
 * Exchanges an authorization code for an access token via LinkedIn's OAuth
 * token endpoint. Returns the token response or throws on failure.
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<LinkedInTokenResponse> {
  const clientId = requireServerEnv("linkedinClientId");
  const clientSecret = requireServerEnv("linkedinClientSecret");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `LinkedIn token exchange failed (${response.status}): ${errorBody}`,
    );
  }

  return (await response.json()) as LinkedInTokenResponse;
}

// ─── User Info ──────────────────────────────────────────────────────────────

/**
 * Fetches the authenticated user's profile information from LinkedIn's
 * OpenID Connect userinfo endpoint.
 */
export async function fetchLinkedInUserInfo(
  accessToken: string,
): Promise<LinkedInUserInfo> {
  const response = await fetch(LINKEDIN_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `LinkedIn userinfo request failed (${response.status}): ${errorBody}`,
    );
  }

  const data = (await response.json()) as Record<string, unknown>;

  return {
    sub: data.sub as string,
    name: typeof data.name === "string" ? data.name : undefined,
    email: typeof data.email === "string" ? data.email : undefined,
  };
}
