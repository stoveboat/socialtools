import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runDiagnostic } from "@/lib/diagnostics/runDiagnostic";

export const maxDuration = 90; // Vercel ceiling for the diagnostic call.

type ScriptVersion = "source" | "refined";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: pieceId } = await params;
  const body = await request.json().catch(() => ({}));
  const scriptVersion: ScriptVersion =
    body.script_version === "refined" ? "refined" : "source";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: piece, error: pieceError } = await supabase
    .from("pieces")
    .select(
      "id, source_script, refined_script, user_id, locked_payoff_type",
    )
    .eq("id", pieceId)
    .single();
  if (pieceError || !piece) {
    return NextResponse.json({ error: "piece_not_found" }, { status: 404 });
  }
  if (piece.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const script =
    scriptVersion === "refined" ? piece.refined_script : piece.source_script;
  if (!script) {
    return NextResponse.json(
      { error: "script_missing", detail: `No ${scriptVersion} script` },
      { status: 400 },
    );
  }

  // If a fully-graded diagnostic for this script_version already exists,
  // return it instead of re-running.
  const { data: existing } = await supabase
    .from("diagnostics")
    .select("id, dimension_grades(count)")
    .eq("piece_id", pieceId)
    .eq("script_version", scriptVersion)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (
    existing &&
    (existing.dimension_grades as { count: number }[])?.[0]?.count === 11
  ) {
    return NextResponse.json({ diagnostic_id: existing.id, cached: true });
  }

  const { data: ctx } = await supabase
    .from("phase_0_contexts")
    .select(
      "topic_summary, audience_selection, custom_audience, channel_selection, custom_channel, traction_selection, custom_traction",
    )
    .eq("piece_id", pieceId)
    .single();
  const audience = ctx?.custom_audience || ctx?.audience_selection || "Unknown";
  const channel = ctx?.custom_channel || ctx?.channel_selection || "Unknown";
  const traction = ctx?.custom_traction || ctx?.traction_selection || "Unknown";

  let report;
  try {
    report = await runDiagnostic({
      script,
      audience,
      channel,
      traction,
      payoff_type: piece.locked_payoff_type ?? undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "grading_failed", detail: (err as Error).message },
      { status: 500 },
    );
  }

  const { data: diag, error: diagError } = await supabase
    .from("diagnostics")
    .insert({
      piece_id: pieceId,
      script_version: scriptVersion,
      routing_recommendation: report.routing_recommendation,
      overall_label: report.overall_label,
    })
    .select("id")
    .single();
  if (diagError || !diag) {
    return NextResponse.json(
      { error: "save_failed", detail: diagError?.message },
      { status: 500 },
    );
  }

  const { error: gradesError } = await supabase.from("dimension_grades").insert(
    report.dimension_grades.map((g) => ({
      diagnostic_id: diag.id,
      dimension_id: g.dimension_id,
      dimension_name: g.dimension_name,
      grade: g.grade,
      evidence: g.evidence,
      repair_suggestion: g.repair_suggestion,
    })),
  );
  if (gradesError) {
    return NextResponse.json(
      { error: "grades_save_failed", detail: gradesError.message },
      { status: 500 },
    );
  }

  await supabase
    .from("pieces")
    .update({
      current_phase: scriptVersion === "refined" ? "phase_3" : "phase_1",
      updated_at: new Date().toISOString(),
    })
    .eq("id", pieceId);

  return NextResponse.json({ diagnostic_id: diag.id });
}
