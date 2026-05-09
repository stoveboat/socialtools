import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  applyOneEdit,
  type FixCandidate,
} from "@/lib/diagnostics/repair";
import { gradeDimension } from "@/lib/diagnostics/grade";
import { DIMENSION_PROMPTS } from "@/lib/diagnostics/prompts";
import type { ChannelContext, DimensionGrade } from "@/lib/diagnostics/types";
import {
  getOrCreateRepairPlan,
  loadDiagnosticOwner,
} from "@/lib/db/repair";

export const maxDuration = 90;

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

interface AutoResolved {
  dimension_id: string;
  dimension_name: string;
  new_grade: string;
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

  // Replace any existing choice for this dimension - the user changed their
  // mind or revisited.
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

  // Compute the remaining queue: dims that were weak in the initial diagnostic
  // and don't yet have a repair_choice. Re-grade those against the new script
  // state and skip any that are no longer weak.
  const { data: initialGrades } = await supabase
    .from("dimension_grades")
    .select("dimension_id, dimension_name, grade")
    .eq("diagnostic_id", diagnosticId);
  const initialWeakIds = new Set(
    (initialGrades ?? [])
      .filter((r) => isWeak(r.grade))
      .map((r) => r.dimension_id),
  );

  const { data: existingChoices } = await supabase
    .from("repair_choices")
    .select("dimension_id, status")
    .eq("repair_plan_id", plan_id);
  const addressedIds = new Set(
    (existingChoices ?? []).map((r) => r.dimension_id),
  );

  const queueIds = [...initialWeakIds]
    .filter((id) => !addressedIds.has(id))
    .sort(
      (a, b) => DIMENSION_ORDER.indexOf(a) - DIMENSION_ORDER.indexOf(b),
    );

  const dimNameById: Record<string, string> = {};
  for (const r of initialGrades ?? []) {
    dimNameById[r.dimension_id] = r.dimension_name;
  }

  // No remaining queue - we're done.
  if (queueIds.length === 0) {
    return NextResponse.json({
      done: true,
      auto_resolved: [] as AutoResolved[],
      next_dimension_id: null,
    });
  }

  // Resolve the channel context for re-grading.
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

  // Skip the re-grade work if the user just skipped this dimension - the
  // script didn't change, so the queue's grades didn't change.
  let regraded: DimensionGrade[] = [];
  if (!skipped) {
    const prompts = queueIds
      .map((id) => DIMENSION_PROMPTS.find((p) => p.id === id))
      .filter((p): p is (typeof DIMENSION_PROMPTS)[number] => Boolean(p));
    try {
      regraded = await Promise.all(
        prompts.map((p) =>
          gradeDimension(p, {
            script: nextScript,
            audience: context.audience,
            channel: context.channel,
            traction: context.traction,
            topic_summary: context.topic_summary,
          }),
        ),
      );
    } catch (err) {
      return NextResponse.json(
        { error: "regrade_failed", detail: (err as Error).message },
        { status: 500 },
      );
    }
  }

  // Mark dims that are no longer weak as auto_resolved so they're skipped
  // going forward.
  const autoResolved: AutoResolved[] = [];
  if (!skipped) {
    const stillWeak: string[] = [];
    for (const g of regraded) {
      if (isWeak(g.grade)) {
        stillWeak.push(g.dimension_id);
      } else {
        autoResolved.push({
          dimension_id: g.dimension_id,
          dimension_name: g.dimension_name,
          new_grade: g.grade,
        });
        await supabase.from("repair_choices").insert({
          repair_plan_id: plan_id,
          dimension_id: g.dimension_id,
          chosen_fix: `Auto-resolved by prior fix (now ${g.grade})`,
          status: "auto_resolved",
        });
      }
    }
    const nextId = queueIds.find((id) => stillWeak.includes(id)) ?? null;
    return NextResponse.json({
      done: nextId === null,
      auto_resolved: autoResolved,
      next_dimension_id: nextId,
    });
  }

  // For skip we don't re-grade — just hand off the next still-queued dim.
  return NextResponse.json({
    done: false,
    auto_resolved: [] as AutoResolved[],
    next_dimension_id: queueIds[0],
  });
}
