import { createClient } from "@/lib/supabase/server";

export async function getOrCreateRepairPlan(
  pieceId: string,
  diagnosticId: string,
): Promise<{ plan_id: string }> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("repair_plans")
    .select("id")
    .eq("piece_id", pieceId)
    .eq("diagnostic_id", diagnosticId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return { plan_id: existing.id };

  const { data: created, error } = await supabase
    .from("repair_plans")
    .insert({
      piece_id: pieceId,
      diagnostic_id: diagnosticId,
      status: "in_progress",
    })
    .select("id")
    .single();
  if (error || !created) {
    throw new Error(`Could not create repair plan: ${error?.message}`);
  }
  return { plan_id: created.id };
}

export async function loadDiagnosticOwner(
  diagnosticId: string,
  userId: string,
): Promise<{ piece_id: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("diagnostics")
    .select("id, piece_id, pieces!inner(user_id)")
    .eq("id", diagnosticId)
    .single();
  if (!data) return null;
  const pieces = data.pieces as { user_id: string } | { user_id: string }[];
  const ownerId = Array.isArray(pieces) ? pieces[0]?.user_id : pieces.user_id;
  if (ownerId !== userId) return null;
  return { piece_id: data.piece_id };
}
