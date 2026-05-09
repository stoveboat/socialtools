import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/header";
import { createClient } from "@/lib/supabase/server";
import { LiteRunner } from "./lite-runner";

export default async function LiteDiagnosticPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/convert/${id}/lite`);

  const { data: piece } = await supabase
    .from("pieces")
    .select("id")
    .eq("id", id)
    .single();
  if (!piece) notFound();

  return (
    <div className="min-h-svh flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-12 max-w-2xl mx-auto w-full space-y-6">
        <header className="space-y-1">
          <p className="text-sm text-muted-foreground">Lite Diagnostic</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Quick check before we derive
          </h1>
          <p className="text-sm text-muted-foreground">
            We'll grade the five foundation dimensions to see if there's
            anything that would weaken the four formats. The full diagnostic
            (eleven dimensions) is still available if you want a deeper read.
          </p>
        </header>

        <LiteRunner pieceId={id} />
      </main>
    </div>
  );
}
