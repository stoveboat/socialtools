import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFixCandidates } from "@/lib/diagnostics/repair";
import type { ChannelContext, DimensionGrade } from "@/lib/diagnostics/types";
import { loadDiagnosticOwner } from "@/lib/db/repair";

export const maxDuration = 60;

export async function POST(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ diagnosticId: string; dimensionId: string }>;
  },
) {
  const { diagnosticId, dimensionId } = await params;

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

  const { data: dimRow } = await supabase
    .from("dimension_grades")
    .select("dimension_id, dimension_name, grade, evidence, repair_suggestion")
    .eq("diagnostic_id", diagnosticId)
    .eq("dimension_id", dimensionId)
    .single();
  if (!dimRow) {
    return NextResponse.json({ error: "dimension_not_found" }, { status: 404 });
  }

  const { data: piece } = await supabase
    .from("pieces")
    .select("source_script")
    .eq("id", owner.piece_id)
    .single();
  if (!piece) return NextResponse.json({ error: "piece_missing" }, { status: 404 });

  const { data: ctx } = await supabase
    .from("phase_0_contexts")
    .select(
      "audience_selection, custom_audience, channel_selection, custom_channel, traction_selection, custom_traction, topic_summary",
    )
    .eq("piece_id", owner.piece_id)
    .single();
  const context: ChannelContext = {
    audience: ctx?.custom_audience || ctx?.audience_selection || "Unknown",
    channel: ctx?.custom_channel || ctx?.channel_selection || "Unknown",
    traction: ctx?.custom_traction || ctx?.traction_selection || "Unknown",
    topic_summary: ctx?.topic_summary || "",
  };

  const grade: DimensionGrade = {
    dimension_id: dimRow.dimension_id as DimensionGrade["dimension_id"],
    dimension_name: dimRow.dimension_name,
    grade: dimRow.grade as DimensionGrade["grade"],
    evidence: dimRow.evidence,
    repair_suggestion: dimRow.repair_suggestion ?? "",
  };

  try {
    const candidates = await generateFixCandidates(
      grade,
      piece.source_script,
      context,
    );
    return NextResponse.json({ candidates });
  } catch (err) {
    return NextResponse.json(
      { error: "generation_failed", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
