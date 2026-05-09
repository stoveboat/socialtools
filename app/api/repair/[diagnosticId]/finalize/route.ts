import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  applyAcceptedEdits,
  type RepairChoiceForApply,
} from "@/lib/diagnostics/repair";
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

  const { data: piece } = await supabase
    .from("pieces")
    .select("source_script")
    .eq("id", owner.piece_id)
    .single();
  if (!piece) {
    return NextResponse.json({ error: "piece_missing" }, { status: 404 });
  }

  const { data: plan } = await supabase
    .from("repair_plans")
    .select("id")
    .eq("piece_id", owner.piece_id)
    .eq("diagnostic_id", diagnosticId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!plan) {
    return NextResponse.json(
      { error: "no_repair_plan", detail: "No repair plan to finalize" },
      { status: 400 },
    );
  }

  const { data: choices } = await supabase
    .from("repair_choices")
    .select(
      "dimension_id, status, original_sentences, replacement_sentences, user_edited_replacement",
    )
    .eq("repair_plan_id", plan.id);

  const list: RepairChoiceForApply[] = (choices ?? []) as RepairChoiceForApply[];
  const { refined, edits } = applyAcceptedEdits(piece.source_script, list);

  const accepted = edits.filter((e) => e.applied).length;
  if (accepted === 0) {
    return NextResponse.json(
      {
        error: "no_edits_applied",
        detail:
          "Every accepted edit failed to match the source script, or all choices were rejected/skipped.",
      },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabase
    .from("pieces")
    .update({
      refined_script: refined,
      current_phase: "phase_3",
      updated_at: new Date().toISOString(),
    })
    .eq("id", owner.piece_id);
  if (updateError) {
    return NextResponse.json(
      { error: "save_failed", detail: updateError.message },
      { status: 500 },
    );
  }

  await supabase
    .from("repair_plans")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", plan.id);

  return NextResponse.json({
    refined_length: refined.length,
    accepted_edits: accepted,
    skipped_edits: edits.length - accepted,
  });
}
