import Link from "next/link";
import { SiteHeader } from "@/components/header";
import { AnalyzeForm } from "./analyze-form";
import { createClient } from "@/lib/supabase/server";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-svh flex flex-col">
      <SiteHeader />
      <main className="flex-1 flex items-start justify-center px-6 py-16">
        <div className="w-full max-w-2xl space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-semibold tracking-tight">
              Get an honest read on your script.
            </h1>
            <p className="text-muted-foreground">
              Paste it, and the tool will read it, grade it, and help you turn
              it into four formats.
            </p>
          </div>

          {error ? (
            <p
              role="alert"
              className="text-sm rounded-md bg-red-50 text-red-900 px-3 py-2 text-center"
            >
              {error}
            </p>
          ) : null}

          <AnalyzeForm />

          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            {user ? (
              <Link href="/pieces" className="underline">
                My saved pieces
              </Link>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
