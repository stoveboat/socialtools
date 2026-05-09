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

  const { data: rows } = await supabase
    .from("dimension_grades")
    .select("dimension_id, grade")
    .eq("diagnostic_id", diagnosticId);
  const weak = (rows ?? [])
    .filter((r) => isWeak(r.grade))
    .sort(
      (a, b) =>
        DIMENSION_ORDER.indexOf(a.dimension_id) -
        DIMENSION_ORDER.indexOf(b.dimension_id),
    );

  if (weak.length === 0) {
    redirect(`/diagnostic/${owner.piece_id}/summary`);
  }

  redirect(`/repair/${diagnosticId}/${weak[0].dimension_id}`);
}
