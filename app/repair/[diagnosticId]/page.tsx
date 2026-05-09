import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadDiagnosticOwner } from "@/lib/db/repair";

const DIMENSION_ORDER = [
  "spine",
  "audience",
  "tension",
  "payoff",
  "authority",
  "hook",
  "structure",
  "specificity",
  "compression",
  "voice",
  "off_positioning",
];

const isWeak = (g: string) => g === "C" || g === "D" || g === "F";

export default async function RepairEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ diagnosticId: string }>;
  searchParams: Promise<{ resolved?: string; from?: string }>;
}) {
  const { diagnosticId } = await params;
  const sp = await searchParams;
  const queryString = new URLSearchParams();
  if (sp.resolved) queryString.set("resolved", sp.resolved);
  if (sp.from) queryString.set("from", sp.from);
  const trailing = queryString.toString() ? `?${queryString.toString()}` : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/repair/${diagnosticId}`);

  const owner = await loadDiagnosticOwner(diagnosticId, user.id);
  if (!owner) notFound();

  const { data: rows } = await supabase
    .from("dimension_grades")
    .select("dimension_id, grade")
    .eq("diagnostic_id", diagnosticId);
  const initialWeak = (rows ?? [])
    .filter((r) => isWeak(r.grade))
    .map((r) => r.dimension_id)
    .sort(
      (a, b) => DIMENSION_ORDER.indexOf(a) - DIMENSION_ORDER.indexOf(b),
    );

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
      .select("dimension_id")
      .eq("repair_plan_id", planRow.id);
    addressed = new Set((choices ?? []).map((c) => c.dimension_id));
  }

  const remaining = initialWeak.filter((id) => !addressed.has(id));

  if (remaining.length === 0) {
    // Everything was either applied, edited, skipped, or auto-resolved. If
    // any fix landed (refined_script populated), go to the comparison view.
    // If only skips/auto-resolves with no real fixes, return to the summary.
    const { data: piece } = await supabase
      .from("pieces")
      .select("refined_script")
      .eq("id", owner.piece_id)
      .single();
    if (piece?.refined_script) {
      redirect(`/repair/${diagnosticId}/review${trailing}`);
    }
    redirect(`/diagnostic/${owner.piece_id}/summary`);
  }

  redirect(`/repair/${diagnosticId}/${remaining[0]}${trailing}`);
}
