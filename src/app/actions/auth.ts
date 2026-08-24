"use server";

import { redirect } from "next/navigation";

import { requirePublicEnv } from "@/config/env";
import { ensureProfile } from "@/lib/auth";
import { createWriteClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createWriteClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // Password logins skip /auth/callback, so the profile row must be
  // ensured here as well (idempotent).
  await ensureProfile();

  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = await createWriteClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Send the confirmation link back to THIS app regardless of the
      // Supabase "Site URL" setting — without this, the email link follows
      // whatever origin is configured in the Supabase dashboard.
      emailRedirectTo: `${requirePublicEnv("appUrl")}/auth/callback`,
      data: {
        timezone: "Africa/Addis_Ababa",
      },
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // When email confirmation is disabled ("Confirm email" OFF), signUp returns
  // a session immediately — go straight to the dashboard. Otherwise tell the
  // user to check their inbox for the confirmation link.
  if (data.session) {
    await ensureProfile();
    redirect("/dashboard");
  }

  redirect("/login?message=check_email");
}

export async function logout() {
  const supabase = await createWriteClient();
  await supabase.auth.signOut();
  redirect("/login");
}
