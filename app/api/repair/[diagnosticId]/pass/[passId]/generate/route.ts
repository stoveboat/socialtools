import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  runEngagementPass,
  runFoundationPass,
  runSurfacePass,
  type FoundationMode,
} from "@/lib/diagnostics/revise";
import type { ChannelContext } from "@/lib/diagnostics/types";
import { type PassId } from "@/lib/diagnostics/passes";
import { loadDiagnosticOwner } from "@/lib/db/repair";

export const maxDuration = 90;

const VALID_PASSES = new Set<PassId>([
  "foundation",
  "engagement_structure",
  "surface",
]);

const VALID_MODES = new Set(["revise", "rebuild", "scratch"]);

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
    .select("source_script, refined_script")
    .eq("id", owner.piece_id)
    .single();
  if (!piece) {
    return NextResponse.json({ error: "piece_missing" }, { status: 404 });
  }
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

  // Allow the user to override the channel-context audience for this pass
  // without altering the saved Phase 0 record.
  const audience =
    typeof body.audience === "string" && body.audience.trim()
      ? body.audience.trim()
      : context.audience;

  const feedback =
    typeof body.feedback === "string" ? body.feedback : undefined;

  try {
    if (passId === "foundation") {
      const mode = String(body.mode ?? "revise");
      if (!VALID_MODES.has(mode)) {
        return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
      }
      const spine =
        typeof body.spine === "string" ? body.spine.trim() : "";
      const payoff_type =
        typeof body.payoff_type === "string" ? body.payoff_type : "";
      if (!spine) {
        return NextResponse.json(
          { error: "spine_required" },
          { status: 400 },
        );
      }
      if (!payoff_type) {
        return NextResponse.json(
          { error: "payoff_type_required" },
          { status: 400 },
        );
      }
      const result = await runFoundationPass({
        mode: mode as FoundationMode,
        spine,
        audience,
        payoff_type,
        channel: context.channel,
        topic_summary: context.topic_summary,
        script: currentScript,
        feedback,
        seed_fragment:
          typeof body.seed_fragment === "string"
            ? body.seed_fragment
            : undefined,
        seed_type:
          typeof body.seed_type === "string" ? body.seed_type : undefined,
      });
      return NextResponse.json({ ...result, source_script: currentScript });
    }

    if (passId === "engagement_structure") {
      const engagement_engine =
        typeof body.engagement_engine === "string"
          ? body.engagement_engine
          : "";
      const structural_shape =
        typeof body.structural_shape === "string"
          ? body.structural_shape
          : "";
      if (!engagement_engine || !structural_shape) {
        return NextResponse.json(
          { error: "engine_and_shape_required" },
          { status: 400 },
        );
      }
      const result = await runEngagementPass({
        engagement_engine,
        structural_shape,
        audience,
        channel: context.channel,
        script: currentScript,
        feedback,
      });
      return NextResponse.json({ ...result, source_script: currentScript });
    }

    // surface
    const result = await runSurfacePass({
      audience,
      channel: context.channel,
      script: currentScript,
      feedback,
    });
    return NextResponse.json({ ...result, source_script: currentScript });
  } catch (err) {
    return NextResponse.json(
      { error: "revision_failed", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
