import { NextResponse } from "next/server";

import { createWriteClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  if (code) {
    const supabase = await createWriteClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Ensure a profile row exists for this user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { error: profileError } = await supabase.from("profiles").upsert(
          {
            id: user.id,
            timezone: "Africa/Addis_Ababa",
          },
          { onConflict: "id" },
        );

        if (profileError) {
          console.error("Profile initialization failed:", profileError.message);
        }
      }

      return NextResponse.redirect(`${origin}${redirect}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
