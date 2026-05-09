import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-svh flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b">
        <span className="font-semibold">Script Diagnostic Tool</span>
        {user ? (
          <form action="/auth/signout" method="post" className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        ) : (
          <Link href="/login">
            <Button size="sm">Sign in</Button>
          </Link>
        )}
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-xl text-center space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight">
            Step 1 scaffold is up.
          </h1>
          <p className="text-muted-foreground">
            {user
              ? "You are signed in. Auth, database schema, and the Anthropic SDK are wired. The product surface comes in subsequent build steps."
              : "Sign in or create an account to verify auth. Then continue with Step 2 of the build sequence."}
          </p>
        </div>
      </main>
    </div>
  );
}
