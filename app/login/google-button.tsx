"use client";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function GoogleButton({ next = "/" }: { next?: string }) {
  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={signInWithGoogle}
    >
      Continue with Google
    </Button>
  );
}
