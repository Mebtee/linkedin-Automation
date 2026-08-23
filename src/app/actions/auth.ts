"use server";

import { redirect } from "next/navigation";

import { requirePublicEnv } from "@/config/env";
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

  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = await createWriteClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signUp({
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

  redirect("/login?message=check_email");
}

export async function logout() {
  const supabase = await createWriteClient();
  await supabase.auth.signOut();
  redirect("/login");
}
