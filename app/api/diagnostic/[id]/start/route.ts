import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runDiagnostic } from "@/lib/diagnostics/runDiagnostic";

export const maxDuration = 90; // Vercel ceiling for the diagnostic call.

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: pieceId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // Owner check + load script.
  const { data: piece, error: pieceError } = await supabase
    .from("pieces")
    .select("id, source_script, user_id")
    .eq("id", pieceId)
    .single();
  if (pieceError || !piece) {
    return NextResponse.json({ error: "piece_not_found" }, { status: 404 });
  }
  if (piece.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Already-complete check: if a fully-graded diagnostic exists for the
  // source script, return it instead of re-running.
  const { data: existing } = await supabase
    .from("diagnostics")
    .select("id, dimension_grades(count)")
    .eq("piece_id", pieceId)
    .eq("script_version", "source")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing && (existing.dimension_grades as { count: number }[])?.[0]?.count === 11) {
    return NextResponse.json({ diagnostic_id: existing.id, cached: true });
  }

  // Resolve the user-confirmed Phase 0 context for this piece.
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

  // Run the diagnostic. Phase 0 inference re-runs here so the grader can use
  // the topic summary even if the saved one is stale; the user's confirmed
  // audience/channel/traction overrides remain in force.
  let report;
  try {
    report = await runDiagnostic({
      script: piece.source_script,
      audience,
      channel,
      traction,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "grading_failed", detail: (err as Error).message },
      { status: 500 },
    );
  }

  // Persist the diagnostic header.
  const { data: diag, error: diagError } = await supabase
    .from("diagnostics")
    .insert({
      piece_id: pieceId,
      script_version: "source",
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

  // Persist the dimension grades.
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

  // Advance the piece phase.
  await supabase
    .from("pieces")
    .update({
      current_phase: "phase_1",
      updated_at: new Date().toISOString(),
    })
    .eq("id", pieceId);

  return NextResponse.json({ diagnostic_id: diag.id });
}
