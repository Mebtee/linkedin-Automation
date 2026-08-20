import { NextResponse } from "next/server";

import { requirePublicEnv } from "@/config/env";
import { createWriteClient } from "@/lib/supabase/server";
import {
  generateOAuthState,
  buildAuthorizationUrl,
  buildReauthAuthorizationUrl,
} from "@/services/linkedin";

export const dynamic = "force-dynamic";

/**
 * GET /api/linkedin/auth?mode=connect|reauth
 *
 * Initiates the LinkedIn OAuth 2.0 authorization-code flow.
 * Requires an authenticated Supabase session (enforced by middleware).
 * Returns a redirect to LinkedIn's authorization page.
 *
 * Modes:
 * - connect (default): Initial connection with openid profile email scopes
 * - reauth: Reauthorization with w_member_social scope for publishing
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") === "reauth" ? "reauth" : "connect";

    const supabase = await createWriteClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const redirectUri = `${requirePublicEnv("appUrl")}/api/linkedin/callback`;

    const state = generateOAuthState(user.id, mode);
    const authUrl =
      mode === "reauth"
        ? buildReauthAuthorizationUrl(state, redirectUri)
        : buildAuthorizationUrl(state, redirectUri);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("LinkedIn auth initiation failed:", error);
    return NextResponse.json(
      { error: "Failed to initiate LinkedIn authentication" },
      { status: 500 },
    );
  }
}
