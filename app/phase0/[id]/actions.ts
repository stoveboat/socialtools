"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function confirmPhase0(pieceId: string, formData: FormData) {
  const audience_selection = String(formData.get("audience_selection") ?? "");
  const custom_audience = String(
    formData.get("custom_audience") ?? "",
  ).trim();
  const channel_selection = String(formData.get("channel_selection") ?? "");
  const custom_channel = String(formData.get("custom_channel") ?? "").trim();
  const traction_selection = String(formData.get("traction_selection") ?? "");
  const custom_traction = String(formData.get("custom_traction") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/phase0/${pieceId}`);

  // Resolve effective values: a custom_* override wins when present and the
  // selection field is "__custom__" (the sentinel used by the radio "Other"
  // option), otherwise we trust the radio selection.
  const audience =
    audience_selection === "__custom__" ? custom_audience : audience_selection;
  const channel =
    channel_selection === "__custom__" ? custom_channel : channel_selection;
  const traction =
    traction_selection === "__custom__" ? custom_traction : traction_selection;

  if (!audience || !channel || !traction) {
    redirect(
      `/phase0/${pieceId}?error=${encodeURIComponent("Please answer all three panels before continuing.")}`,
    );
  }

  // Update the existing Phase 0 context row (one per piece).
  const { error: ctxError } = await supabase
    .from("phase_0_contexts")
    .update({
      audience_selection: audience_selection === "__custom__" ? null : audience_selection,
      custom_audience: audience_selection === "__custom__" ? custom_audience : null,
      channel_selection: channel_selection === "__custom__" ? null : channel_selection,
      custom_channel: channel_selection === "__custom__" ? custom_channel : null,
      traction_selection: traction_selection === "__custom__" ? null : traction_selection,
      custom_traction: traction_selection === "__custom__" ? custom_traction : null,
    })
    .eq("piece_id", pieceId);

  if (ctxError) {
    redirect(
      `/phase0/${pieceId}?error=${encodeURIComponent(`Save failed: ${ctxError.message}`)}`,
    );
  }

  await supabase
    .from("pieces")
    .update({ current_phase: "decision_screen", updated_at: new Date().toISOString() })
    .eq("id", pieceId);

  redirect(`/decision/${pieceId}`);
}
