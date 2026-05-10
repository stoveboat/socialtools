import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { passesNeeded } from "@/lib/diagnostics/passes";
import { loadDiagnosticOwner } from "@/lib/db/repair";
import type { Grade } from "@/lib/diagnostics/types";

export default async function RepairEntryPage({
  params,
}: {
  params: Promise<{ diagnosticId: string }>;
}) {
  const { diagnosticId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/repair/${diagnosticId}`);

  const owner = await loadDiagnosticOwner(diagnosticId, user.id);
  if (!owner) notFound();

  // Use the latest persisted diagnostic — refined if any pass has landed,
  // else the original source diagnostic.
  const { data: latestDiag } = await supabase
    .from("diagnostics")
    .select("id")
    .eq("piece_id", owner.piece_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestDiagId = latestDiag?.id ?? diagnosticId;

  const { data: rows } = await supabase
    .from("dimension_grades")
    .select("dimension_id, grade")
    .eq("diagnostic_id", latestDiagId);

  const passes = passesNeeded(
    (rows ?? []).map((r) => ({
      dimension_id: r.dimension_id,
      grade: r.grade as Grade,
    })),
  );

  if (passes.length === 0) {
    const { data: piece } = await supabase
      .from("pieces")
      .select("refined_script")
      .eq("id", owner.piece_id)
      .single();
    if (piece?.refined_script) {
      redirect(`/repair/${diagnosticId}/review`);
    }
    redirect(`/diagnostic/${owner.piece_id}/summary`);
  }

  redirect(`/repair/${diagnosticId}/${passes[0]}`);
}
