import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFixCandidates } from "@/lib/diagnostics/repair";
import { gradeDimension } from "@/lib/diagnostics/grade";
import { DIMENSION_PROMPTS } from "@/lib/diagnostics/prompts";
import type { ChannelContext, DimensionGrade } from "@/lib/diagnostics/types";
import {
  getOrCreateRepairPlan,
  loadDiagnosticOwner,
} from "@/lib/db/repair";

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

  const dimensionPrompt = DIMENSION_PROMPTS.find((p) => p.id === dimensionId);
  if (!dimensionPrompt) {
    return NextResponse.json({ error: "unknown_dimension" }, { status: 400 });
  }

  const { data: piece } = await supabase
    .from("pieces")
    .select("source_script, refined_script")
    .eq("id", owner.piece_id)
    .single();
  if (!piece) {
    return NextResponse.json({ error: "piece_missing" }, { status: 404 });
  }

  // The current script state is the running refined draft if it exists, else
  // the source. Each accepted fix updates refined_script, so candidates are
  // always generated against the latest draft - not the original.
  const currentScript = piece.refined_script ?? piece.source_script;

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

  // Re-grade this single dimension against the CURRENT script state. The
  // initial diagnostic's evidence is stale once any fix has been applied.
  let freshGrade: DimensionGrade;
  try {
    freshGrade = await gradeDimension(dimensionPrompt, {
      script: currentScript,
      audience: context.audience,
      channel: context.channel,
      traction: context.traction,
      topic_summary: context.topic_summary,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "regrade_failed", detail: (err as Error).message },
      { status: 500 },
    );
  }

  // If the dimension is no longer weak, surface that to the client so it can
  // route past this card and tell the user the prior fix already addressed it.
  const stillWeak =
    freshGrade.grade === "C" ||
    freshGrade.grade === "D" ||
    freshGrade.grade === "F";

  if (!stillWeak) {
    // Persist the auto-resolution so the entry router skips this dimension
    // on the next visit. Replace any existing choice for the same dim.
    const { plan_id } = await getOrCreateRepairPlan(
      owner.piece_id,
      diagnosticId,
    );
    await supabase
      .from("repair_choices")
      .delete()
      .eq("repair_plan_id", plan_id)
      .eq("dimension_id", dimensionId);
    await supabase.from("repair_choices").insert({
      repair_plan_id: plan_id,
      dimension_id: dimensionId,
      chosen_fix: `Auto-resolved on revisit (now ${freshGrade.grade})`,
      status: "auto_resolved",
    });
    return NextResponse.json({
      auto_resolved: true,
      fresh_grade: freshGrade,
      candidates: [],
    });
  }

  try {
    const candidates = await generateFixCandidates(
      freshGrade,
      currentScript,
      context,
    );
    return NextResponse.json({
      auto_resolved: false,
      fresh_grade: freshGrade,
      candidates,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "generation_failed", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
