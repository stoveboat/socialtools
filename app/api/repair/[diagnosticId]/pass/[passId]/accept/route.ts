import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gradeDimension } from "@/lib/diagnostics/grade";
import { DIMENSION_PROMPTS } from "@/lib/diagnostics/prompts";
import { type PassId } from "@/lib/diagnostics/passes";
import type { ChannelContext, DimensionGrade } from "@/lib/diagnostics/types";
import {
  getOrCreateRepairPlan,
  loadDiagnosticOwner,
} from "@/lib/db/repair";

export const maxDuration = 120;

const VALID_PASSES = new Set<PassId>([
  "foundation",
  "engagement_structure",
  "surface",
]);

const isWeak = (g: string) => g === "C" || g === "D" || g === "F";

function classifyOverall(grades: DimensionGrade[]): {
  overall: "Strong" | "Mixed" | "Needs Work";
  routing:
    | "ready_to_ship"
    | "surgical_repair"
    | "skeleton_mode"
    | "back_to_phase_0";
} {
  const FOUNDATION = new Set([
    "spine",
    "audience",
    "tension",
    "payoff",
    "authority",
  ]);
  const foundation = grades.filter((g) => FOUNDATION.has(g.dimension_id));
  const execution = grades.filter((g) => !FOUNDATION.has(g.dimension_id));
  const weakFoundation = foundation.filter((g) => isWeak(g.grade));
  const weakExecution = execution.filter((g) => isWeak(g.grade));
  const spineGrade = grades.find((g) => g.dimension_id === "spine")?.grade;

  if (weakFoundation.length === 0 && weakExecution.length === 0) {
    return { overall: "Strong", routing: "ready_to_ship" };
  }
  if (weakFoundation.length >= 3 || spineGrade === "F") {
    return { overall: "Needs Work", routing: "back_to_phase_0" };
  }
  if (
    weakFoundation.length >= 1 ||
    (weakFoundation.length === 0 && weakExecution.length >= 5)
  ) {
    return { overall: "Needs Work", routing: "skeleton_mode" };
  }
  return { overall: "Mixed", routing: "surgical_repair" };
}

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ diagnosticId: string; passId: string }>;
  },
) {
  const { diagnosticId, passId } = await params;
  if (!VALID_PASSES.has(passId as PassId)) {
    return NextResponse.json({ error: "unknown_pass" }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const revisedScript =
    typeof body.revised_script === "string"
      ? body.revised_script.trim()
      : "";
  if (!revisedScript) {
    return NextResponse.json(
      { error: "revised_script_required" },
      { status: 400 },
    );
  }

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

  // Save the revision as the new running draft. If this is the Foundation
  // pass, the user picked a payoff type as part of their directional choices;
  // persist it so subsequent re-grades can apply payoff-aware rubrics
  // (Specificity in particular).
  const lockedPayoff =
    typeof body.locked_payoff_type === "string" &&
    body.locked_payoff_type.trim()
      ? body.locked_payoff_type.trim()
      : undefined;
  const updatePayload: Record<string, unknown> = {
    refined_script: revisedScript,
    current_phase: "phase_3",
    updated_at: new Date().toISOString(),
  };
  if (lockedPayoff) updatePayload.locked_payoff_type = lockedPayoff;
  const { error: updateError } = await supabase
    .from("pieces")
    .update(updatePayload)
    .eq("id", owner.piece_id);
  if (updateError) {
    return NextResponse.json(
      { error: "save_failed", detail: updateError.message },
      { status: 500 },
    );
  }

  // Pass-scope dimension overrides apply only to the active diagnostic.
  // When a new diagnostic is generated below, those overrides should be
  // dropped — piece-scope overrides survive.
  await supabase
    .from("dimension_overrides")
    .delete()
    .eq("piece_id", owner.piece_id)
    .eq("scope", "pass");

  // Record the pass acceptance against the repair plan. repair_choices is
  // repurposed here: one row per accepted pass, with chosen_fix carrying the
  // pass id and the directional choices serialized in user_edited_replacement
  // for audit. Schema migration is unnecessary for v1.
  const { plan_id } = await getOrCreateRepairPlan(
    owner.piece_id,
    diagnosticId,
  );
  await supabase.from("repair_choices").insert({
    repair_plan_id: plan_id,
    dimension_id: passId, // pass id stored in dimension_id slot
    chosen_fix: `Pass accepted: ${passId}`,
    status: "accepted",
    user_edited_replacement:
      typeof body.directional_choices === "string"
        ? body.directional_choices
        : null,
    applied_at: new Date().toISOString(),
  });

  // Re-run the full eleven-dimension diagnostic against the new draft so the
  // Summary reflects post-pass state and the next-pass recommendation is
  // computed against fresh grades.
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
  // Read the (possibly just-updated) locked payoff type so the Specificity
  // grader applies the right rubric. lockedPayoff above takes precedence —
  // it's what the user just chose in this pass.
  const { data: refreshedPiece } = await supabase
    .from("pieces")
    .select("locked_payoff_type")
    .eq("id", owner.piece_id)
    .single();
  const payoffType =
    lockedPayoff || refreshedPiece?.locked_payoff_type || "UNKNOWN";

  const vars = {
    script: revisedScript,
    audience: context.audience,
    channel: context.channel,
    traction: context.traction,
    topic_summary: context.topic_summary,
    payoff_type: payoffType,
  };

  let regraded: DimensionGrade[];
  try {
    regraded = await Promise.all(
      DIMENSION_PROMPTS.map((p) => gradeDimension(p, vars)),
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: "regrade_failed",
        detail: (err as Error).message,
        partial: { saved: true },
      },
      { status: 500 },
    );
  }
  const { overall, routing } = classifyOverall(regraded);

  // Replace the refined diagnostic in place.
  const { data: existingRefined } = await supabase
    .from("diagnostics")
    .select("id")
    .eq("piece_id", owner.piece_id)
    .eq("script_version", "refined")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let refinedDiagId: string;
  if (existingRefined) {
    refinedDiagId = existingRefined.id;
    await supabase
      .from("dimension_grades")
      .delete()
      .eq("diagnostic_id", refinedDiagId);
    await supabase
      .from("diagnostics")
      .update({
        routing_recommendation: routing,
        overall_label: overall,
      })
      .eq("id", refinedDiagId);
  } else {
    const { data: created, error: createError } = await supabase
      .from("diagnostics")
      .insert({
        piece_id: owner.piece_id,
        script_version: "refined",
        routing_recommendation: routing,
        overall_label: overall,
      })
      .select("id")
      .single();
    if (createError || !created) {
      return NextResponse.json(
        { error: "save_failed", detail: createError?.message },
        { status: 500 },
      );
    }
    refinedDiagId = created.id;
  }

  await supabase.from("dimension_grades").insert(
    regraded.map((g) => ({
      diagnostic_id: refinedDiagId,
      dimension_id: g.dimension_id,
      dimension_name: g.dimension_name,
      grade: g.grade,
      evidence: g.evidence,
      repair_suggestion: g.repair_suggestion,
    })),
  );

  return NextResponse.json({
    ok: true,
    overall_label: overall,
    routing_recommendation: routing,
    piece_id: owner.piece_id,
  });
}
