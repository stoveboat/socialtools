import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  applyOneEdit,
  type FixCandidate,
} from "@/lib/diagnostics/repair";
import { gradeDimension } from "@/lib/diagnostics/grade";
import { DIMENSION_PROMPTS } from "@/lib/diagnostics/prompts";
import type { ChannelContext, DimensionGrade } from "@/lib/diagnostics/types";
import { computeQueue } from "@/lib/diagnostics/repair-order";
import {
  getOrCreateRepairPlan,
  loadDiagnosticOwner,
} from "@/lib/db/repair";

export const maxDuration = 90;

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
    params: Promise<{ diagnosticId: string; dimensionId: string }>;
  },
) {
  const { diagnosticId, dimensionId } = await params;
  const body = await request.json().catch(() => ({}));
  const skipped = body.skipped === true;
  const candidate = body.candidate as FixCandidate | undefined;
  const editedReplacement: string | undefined =
    typeof body.edited_replacement === "string"
      ? body.edited_replacement
      : undefined;

  if (!skipped && (!candidate || !Array.isArray(candidate.original_sentences))) {
    return NextResponse.json(
      { error: "must_provide_candidate_or_skipped" },
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

  const { plan_id } = await getOrCreateRepairPlan(
    owner.piece_id,
    diagnosticId,
  );

  const { data: piece } = await supabase
    .from("pieces")
    .select("source_script, refined_script")
    .eq("id", owner.piece_id)
    .single();
  if (!piece) {
    return NextResponse.json({ error: "piece_missing" }, { status: 404 });
  }
  const currentScript = piece.refined_script ?? piece.source_script;

  // Replace any existing choice for this dimension - the user may have
  // revisited and changed their mind.
  await supabase
    .from("repair_choices")
    .delete()
    .eq("repair_plan_id", plan_id)
    .eq("dimension_id", dimensionId);

  let nextScript = currentScript;
  if (skipped) {
    await supabase.from("repair_choices").insert({
      repair_plan_id: plan_id,
      dimension_id: dimensionId,
      chosen_fix: "Skipped",
      status: "skipped",
    });
  } else {
    const replacementText = editedReplacement
      ? editedReplacement
      : candidate!.replacement_sentences.join(" ");
    const result = applyOneEdit(
      currentScript,
      candidate!.original_sentences,
      replacementText,
    );
    if (!result.applied) {
      return NextResponse.json(
        { error: "edit_did_not_match", detail: result.reason },
        { status: 409 },
      );
    }
    nextScript = result.refined;

    await supabase.from("repair_choices").insert({
      repair_plan_id: plan_id,
      dimension_id: dimensionId,
      chosen_fix: candidate!.description,
      status: editedReplacement ? "edited" : "accepted",
      original_sentences: candidate!.original_sentences,
      replacement_sentences: candidate!.replacement_sentences,
      user_edited_replacement: editedReplacement ?? null,
      applied_at: new Date().toISOString(),
    });

    await supabase
      .from("pieces")
      .update({
        refined_script: nextScript,
        current_phase: "phase_3",
        updated_at: new Date().toISOString(),
      })
      .eq("id", owner.piece_id);
  }

  // For a skip with no script change, re-grading is wasted work — return the
  // queue from the latest persisted diagnostic.
  if (skipped) {
    const { data: latestRefined } = await supabase
      .from("diagnostics")
      .select("id")
      .eq("piece_id", owner.piece_id)
      .eq("script_version", "refined")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const latestId = latestRefined?.id ?? diagnosticId;
    const { data: latestGrades } = await supabase
      .from("dimension_grades")
      .select("dimension_id, grade")
      .eq("diagnostic_id", latestId);
    const { data: choices } = await supabase
      .from("repair_choices")
      .select("dimension_id")
      .eq("repair_plan_id", plan_id);
    const addressed = new Set((choices ?? []).map((r) => r.dimension_id));
    const queue = computeQueue(latestGrades ?? [], addressed);
    return NextResponse.json({
      done: queue.length === 0,
      next_dimension_id: queue[0]?.dimension_id ?? null,
    });
  }

  // Apply landed - re-grade ALL 11 dimensions in parallel against the new
  // draft so the user sees the full impact of their fix, including
  // dimensions that weren't in the original queue.
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

  const vars = {
    script: nextScript,
    audience: context.audience,
    channel: context.channel,
    traction: context.traction,
    topic_summary: context.topic_summary,
  };

  let regraded: DimensionGrade[];
  try {
    regraded = await Promise.all(
      DIMENSION_PROMPTS.map((p) => gradeDimension(p, vars)),
    );
  } catch (err) {
    return NextResponse.json(
      { error: "regrade_failed", detail: (err as Error).message },
      { status: 500 },
    );
  }

  const { overall, routing } = classifyOverall(regraded);

  // Replace the refined diagnostic in place. If one doesn't exist yet, create
  // it; otherwise update its row and replace its dimension_grades.
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

  // Compute next-up dim from the new weak set, ordered by text position,
  // excluding dimensions the user has already addressed.
  const { data: choices } = await supabase
    .from("repair_choices")
    .select("dimension_id")
    .eq("repair_plan_id", plan_id);
  const addressed = new Set((choices ?? []).map((r) => r.dimension_id));
  const queue = computeQueue(regraded, addressed);

  return NextResponse.json({
    done: queue.length === 0,
    next_dimension_id: queue[0]?.dimension_id ?? null,
    overall_label: overall,
    routing_recommendation: routing,
  });
}
