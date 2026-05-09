import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/header";
import { createClient } from "@/lib/supabase/server";
import { LoadingRunner } from "./loading-runner";

export default async function DiagnosticLoadingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/diagnostic/${id}`);

  const { data: piece } = await supabase
    .from("pieces")
    .select("id")
    .eq("id", id)
    .single();
  if (!piece) notFound();

  // If a complete diagnostic already exists for the source script, skip
  // straight to the summary. RLS guarantees we only see the user's pieces.
  const { data: existing } = await supabase
    .from("diagnostics")
    .select("id, dimension_grades(count)")
    .eq("piece_id", id)
    .eq("script_version", "source")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (
    existing &&
    (existing.dimension_grades as { count: number }[])?.[0]?.count === 11
  ) {
    redirect(`/diagnostic/${id}/summary`);
  }

  return (
    <div className="min-h-svh flex flex-col">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <LoadingRunner pieceId={id} />
        </div>
      </main>
    </div>
  );
}
