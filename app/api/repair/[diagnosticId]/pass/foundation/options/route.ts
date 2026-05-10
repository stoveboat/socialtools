import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateSalvageableSeeds,
  generateSpineCandidates,
} from "@/lib/diagnostics/revise";
import type { ChannelContext } from "@/lib/diagnostics/types";
import { loadDiagnosticOwner } from "@/lib/db/repair";

export const maxDuration = 60;

// Returns the directional-choice options the user picks from when starting a
// Foundation pass: 3 candidate spines (drawn or sharpened) plus 0-4
// salvageable seeds (used by the "rebuild from seed" mode).
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

  try {
    const [spine_candidates, salvageable_seeds] = await Promise.all([
      generateSpineCandidates(currentScript, context),
      generateSalvageableSeeds(currentScript, context),
    ]);
    return NextResponse.json({
      spine_candidates,
      salvageable_seeds,
      audience: context.audience,
      channel: context.channel,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "options_failed", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
