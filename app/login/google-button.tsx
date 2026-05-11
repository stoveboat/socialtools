"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function GoogleButton({ next = "/" }: { next?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signInWithGoogle() {
    setError(null);
    setPending(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }
    if (!data?.url) {
      setError(
        "Supabase returned no OAuth URL. The Google provider may not be enabled in Supabase.",
      );
      setPending(false);
      return;
    }
    // supabase-js handles the redirect automatically when running in a
    // browser context, but we set it explicitly here so failure is visible
    // rather than silent.
    window.location.href = data.url;
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={signInWithGoogle}
        disabled={pending}
      >
        {pending ? "Redirecting..." : "Continue with Google"}
      </Button>
      {error ? (
        <p
          role="alert"
          className="text-xs rounded-md bg-red-50 text-red-900 px-3 py-2"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
