"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { runPhase0 } from "@/lib/diagnostics/grade";

const MIN_WORDS = 30;
const MAX_WORDS = 1500;

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export async function analyzeScript(formData: FormData) {
  const script = String(formData.get("script") ?? "").trim();
  const words = countWords(script);

  if (words < MIN_WORDS) {
    redirect(
      `/?error=${encodeURIComponent(`Scripts under ${MIN_WORDS} words are too short to analyze. Add more content.`)}`,
    );
  }
  if (words > MAX_WORDS) {
    redirect(
      `/?error=${encodeURIComponent(`The tool is built for short-form video scripts (≈8-10 minutes of speaking time, ${MAX_WORDS} words). Trim to a shorter excerpt or focus on one segment.`)}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/");
  }

  const { data: piece, error: pieceError } = await supabase
    .from("pieces")
    .insert({ user_id: user.id, source_script: script })
    .select("id")
    .single();
  if (pieceError || !piece) {
    redirect(
      `/?error=${encodeURIComponent(`Failed to save script: ${pieceError?.message ?? "unknown error"}`)}`,
    );
  }

  let phase0;
  try {
    phase0 = await runPhase0(script);
  } catch (err) {
    redirect(
      `/?error=${encodeURIComponent(`Phase 0 inference failed: ${(err as Error).message}`)}`,
    );
  }

  const { error: ctxError } = await supabase.from("phase_0_contexts").insert({
    piece_id: piece.id,
    topic_summary: phase0.topic_summary,
    audience_candidates: phase0.audience_candidates,
    channel_candidates: phase0.channel_candidates,
    is_low_confidence: phase0.is_low_confidence,
    evidence_notes: phase0.evidence_notes,
  });
  if (ctxError) {
    redirect(
      `/?error=${encodeURIComponent(`Failed to save Phase 0 context: ${ctxError.message}`)}`,
    );
  }

  redirect(`/phase0/${piece.id}`);
}
