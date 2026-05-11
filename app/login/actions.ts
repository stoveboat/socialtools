"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Resolve the canonical site URL for outbound redirect links (e.g., email
// confirmation). Precedence:
//   1. Explicit NEXT_PUBLIC_SITE_URL — for custom domains or local overrides.
//   2. VERCEL_PROJECT_PRODUCTION_URL — Vercel-provided, points at the
//      production domain regardless of which deployment is serving.
//   3. VERCEL_URL — the specific deployment URL (preview deploys etc.).
//   4. localhost — development fallback.
function resolveSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function loginWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/");
}

export async function signupWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${resolveSiteUrl()}/auth/confirm`,
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }
  // When email confirmation is off, signUp returns a live session and the
  // user is already authenticated. Otherwise we wait for them to click the
  // confirmation link.
  if (data.session) {
    redirect("/");
  }
  redirect("/signup?check_email=1");
}
