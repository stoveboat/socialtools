import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b">
      <Link href="/" className="font-semibold">
        Hooklab
      </Link>
      {user ? (
        <div className="flex items-center gap-4">
          <Link
            href="/pieces"
            className="text-sm underline text-muted-foreground"
          >
            My pieces
          </Link>
          <form
            action="/auth/signout"
            method="post"
            className="flex items-center gap-3"
          >
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      ) : (
        <Link href="/login">
          <Button size="sm">Sign in</Button>
        </Link>
      )}
    </header>
  );
}
