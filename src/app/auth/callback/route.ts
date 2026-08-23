import { NextResponse } from "next/server";

import { createWriteClient } from "@/lib/supabase/server";

/**
 * Only same-origin relative paths may be used as the post-login destination.
 * Rejects protocol-relative ("//evil.com") and absolute URLs.
 */
function safeRedirectPath(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/dashboard";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const tokenType = searchParams.get("type");
  const redirect = safeRedirectPath(searchParams.get("redirect"));

  const supabase = await createWriteClient();

  // Flow A (default): PKCE confirmation links land here with ?code=...
  // The code verifier lives in a cookie set during signUp — so the link must
  // be opened in the SAME browser that initiated the signup.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      await ensureProfile(supabase);
      return NextResponse.redirect(`${origin}${redirect}`);
    }

    console.error(
      "[auth/callback] Code exchange failed. Common causes: the email link was opened in a different browser/device than the one used to sign up (PKCE verifier cookie missing), a mail scanner pre-opened and consumed the one-time code, or the link was already used.",
      error.message,
    );
    return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
  }

  // Flow B (fallback): templates using {{ .TokenURL }} produce
  // ?token_hash=...&type=signup — verify directly, no verifier cookie needed.
  if (tokenHash && tokenType) {
    const { error } = await supabase.auth.verifyOtp({
      type: "signup",
      token_hash: tokenHash,
    });

    if (!error) {
      await ensureProfile(supabase);
      return NextResponse.redirect(`${origin}${redirect}`);
    }

    console.error("[auth/callback] OTP verification failed:", error.message);
    return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
  }

  console.error(
    "[auth/callback] Neither `code` nor `token_hash` present in callback URL.",
  );
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}

/**
 * Ensures a profile row exists for the freshly authenticated user.
 */
async function ensureProfile(supabase: Awaited<ReturnType<typeof createWriteClient>>): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      timezone: "Africa/Addis_Ababa",
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("Profile initialization failed:", error.message);
  }
}
