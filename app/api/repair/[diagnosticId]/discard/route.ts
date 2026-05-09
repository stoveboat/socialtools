import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadDiagnosticOwner } from "@/lib/db/repair";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ diagnosticId: string }> },
) {
  const { diagnosticId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const owner = await loadDiagnosticOwner(diagnosticId, user.id);
  if (!owner) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Clear the refined script so downstream (derivation) reverts to source.
  // Leave the repair_plans/repair_choices rows in place as history.
  await supabase
    .from("pieces")
    .update({
      refined_script: null,
      current_phase: "phase_1",
      updated_at: new Date().toISOString(),
    })
    .eq("id", owner.piece_id);

  // Mark any refined diagnostic so it doesn't pollute future comparisons.
  // We delete dimension_grades for refined diagnostics, then the diagnostic
  // rows themselves. Cascades handle dimension_grades, but we're explicit for
  // clarity.
  const { data: refinedDiags } = await supabase
    .from("diagnostics")
    .select("id")
    .eq("piece_id", owner.piece_id)
    .eq("script_version", "refined");
  for (const d of refinedDiags ?? []) {
    await supabase.from("dimension_grades").delete().eq("diagnostic_id", d.id);
  }
  await supabase
    .from("diagnostics")
    .delete()
    .eq("piece_id", owner.piece_id)
    .eq("script_version", "refined");

  return NextResponse.json({ ok: true, piece_id: owner.piece_id });
}
