import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/header";
import { createClient } from "@/lib/supabase/server";
import { loadDiagnosticOwner } from "@/lib/db/repair";
import { RewriteFlow, type PendingEdit } from "./rewrite-flow";

export default async function RewritePage({
  params,
}: {
  params: Promise<{ diagnosticId: string }>;
}) {
  const { diagnosticId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/repair/${diagnosticId}/rewrite`);

  const owner = await loadDiagnosticOwner(diagnosticId, user.id);
  if (!owner) notFound();

  const { data: piece } = await supabase
    .from("pieces")
    .select("source_script")
    .eq("id", owner.piece_id)
    .single();
  if (!piece) notFound();

  const { data: plan } = await supabase
    .from("repair_plans")
    .select("id")
    .eq("piece_id", owner.piece_id)
    .eq("diagnostic_id", diagnosticId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let edits: PendingEdit[] = [];
  if (plan) {
    const { data: rows } = await supabase
      .from("repair_choices")
      .select(
        "id, dimension_id, chosen_fix, status, original_sentences, replacement_sentences, user_edited_replacement",
      )
      .eq("repair_plan_id", plan.id)
      .neq("status", "skipped")
      .order("created_at", { ascending: true });

    const { data: dimNames } = await supabase
      .from("dimension_grades")
      .select("dimension_id, dimension_name")
      .eq("diagnostic_id", diagnosticId);
    const nameByDim: Record<string, string> = {};
    for (const r of dimNames ?? []) {
      nameByDim[r.dimension_id] = r.dimension_name;
    }

    edits = (rows ?? [])
      .filter(
        (r) =>
          Array.isArray(r.original_sentences) &&
          Array.isArray(r.replacement_sentences),
      )
      .map((r) => ({
        choice_id: r.id,
        dimension_id: r.dimension_id,
        dimension_name: nameByDim[r.dimension_id] ?? r.dimension_id,
        description: r.chosen_fix,
        original: (r.original_sentences as string[]).join(" "),
        replacement: (r.replacement_sentences as string[]).join(" "),
        user_edited_replacement: r.user_edited_replacement,
        status: r.status,
      }));
  }

  return (
    <div className="min-h-svh flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-10 max-w-6xl mx-auto w-full space-y-6">
        <Link
          href={`/repair/${diagnosticId}`}
          className="text-sm underline text-muted-foreground inline-block"
        >
          ← Back to repair cards
        </Link>

        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Surgical rewrite
          </h1>
          <p className="text-sm text-muted-foreground">
            Each edit shown one at a time. Accept, edit before accepting, or
            reject.
          </p>
        </header>

        <RewriteFlow
          diagnosticId={diagnosticId}
          pieceId={owner.piece_id}
          source_script={piece.source_script}
          edits={edits}
        />
      </main>
    </div>
  );
}
