import "server-only";

import { publicEnv } from "@/config/env";

/**
 * Builds the LinkedIn OAuth 2.0 `redirect_uri`.
 *
 * The same value is used for both the authorization URL (the browser is sent
 * there) and the authorization-code → access-token exchange, so LinkedIn
 * always matches the callback it redirected to.
 *
 * Resolution order:
 * 1. `NEXT_PUBLIC_APP_URL` (the existing environment configuration pattern).
 *    Local development sets it to `http://localhost:3000`; production must set
 *    it to the deployed HTTPS origin (e.g. `https://<production-domain>`).
 * 2. When `NEXT_PUBLIC_APP_URL` is unset/empty, the current request's origin.
 *    This keeps the callback correct for the environment actually being hit,
 *    so a deployed app never points at localhost.
 */
export function resolveLinkedInCallbackRedirectUri(request: Request): string {
  const configured = publicEnv.appUrl?.trim().replace(/\/+$/, "");
  const base = configured ? configured : new URL(request.url).origin;
  return `${base}/api/linkedin/callback`;
}