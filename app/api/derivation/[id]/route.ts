import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateBrief } from "@/lib/diagnostics/derive";
import type { ChannelContext, DerivationFormat } from "@/lib/diagnostics/types";

export const maxDuration = 60;

const VALID_FORMATS = new Set<DerivationFormat>([
  "carousel",
  "caption_reel",
  "voiceover_broll",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: pieceId } = await params;
  const body = await request.json().catch(() => ({}));
  const format = body.format as DerivationFormat;
  const register = String(body.register ?? "").trim();

  if (!VALID_FORMATS.has(format)) {
    return NextResponse.json({ error: "invalid_format" }, { status: 400 });
  }
  if (!register) {
    return NextResponse.json({ error: "register_required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: piece } = await supabase
    .from("pieces")
    .select("id, source_script, refined_script, user_id")
    .eq("id", pieceId)
    .single();
  if (!piece) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (piece.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Use refined script if it exists, else source.
  const useRefined = !!piece.refined_script;
  const script = useRefined ? piece.refined_script! : piece.source_script;

  const { data: ctx } = await supabase
    .from("phase_0_contexts")
    .select(
      "audience_selection, custom_audience, channel_selection, custom_channel, traction_selection, custom_traction, topic_summary",
    )
    .eq("piece_id", pieceId)
    .single();
  const context: ChannelContext = {
    audience: ctx?.custom_audience || ctx?.audience_selection || "Unknown",
    channel: ctx?.custom_channel || ctx?.channel_selection || "Unknown",
    traction: ctx?.custom_traction || ctx?.traction_selection || "Unknown",
    topic_summary: ctx?.topic_summary || "",
  };

  let brief;
  try {
    brief = await generateBrief(format, register, script, context);
  } catch (err) {
    return NextResponse.json(
      { error: "generation_failed", detail: (err as Error).message },
      { status: 500 },
    );
  }

  // Mark any existing active brief for this piece+format as discarded so the
  // unique active-index in the schema doesn't conflict.
  await supabase
    .from("derivation_briefs")
    .update({ status: "discarded" })
    .eq("piece_id", pieceId)
    .eq("format", format)
    .neq("status", "discarded");

  const { data: row, error: insertError } = await supabase
    .from("derivation_briefs")
    .insert({
      piece_id: pieceId,
      source_script_version: useRefined ? "refined" : "source",
      format,
      register,
      brief_content: brief,
      status: "generated",
    })
    .select("id")
    .single();
  if (insertError || !row) {
    return NextResponse.json(
      { error: "save_failed", detail: insertError?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ brief_id: row.id });
}
