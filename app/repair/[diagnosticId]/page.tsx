import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeQueue } from "@/lib/diagnostics/repair-order";
import { loadDiagnosticOwner } from "@/lib/db/repair";

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

  // Pick the most recent diagnostic for this piece (refined if one exists,
  // else the original source diagnostic). The queue is computed against the
  // CURRENT grades, not the initial ones — fixes that side-effect-resolved
  // other dimensions naturally drop out.
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

  const { data: planRow } = await supabase
    .from("repair_plans")
    .select("id")
    .eq("piece_id", owner.piece_id)
    .eq("diagnostic_id", diagnosticId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let addressed = new Set<string>();
  if (planRow) {
    const { data: choices } = await supabase
      .from("repair_choices")
      .select("dimension_id, status")
      .eq("repair_plan_id", planRow.id);
    addressed = new Set(
      (choices ?? [])
        .filter((c) =>
          ["accepted", "edited", "skipped", "auto_resolved"].includes(c.status),
        )
        .map((c) => c.dimension_id),
    );
  }

  const queue = computeQueue(rows ?? [], addressed);

  if (queue.length === 0) {
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

  redirect(`/repair/${diagnosticId}/${queue[0].dimension_id}`);
}
