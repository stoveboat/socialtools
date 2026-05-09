import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getOrCreateRepairPlan,
  loadDiagnosticOwner,
} from "@/lib/db/repair";
import type { FixCandidate } from "@/lib/diagnostics/repair";

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

  // Replace any existing choice for this dimension (user changed their mind).
  await supabase
    .from("repair_choices")
    .delete()
    .eq("repair_plan_id", plan_id)
    .eq("dimension_id", dimensionId);

  const insert: Record<string, unknown> = {
    repair_plan_id: plan_id,
    dimension_id: dimensionId,
  };
  if (skipped) {
    insert.chosen_fix = "Skipped";
    insert.status = "skipped";
  } else {
    insert.chosen_fix = candidate!.description;
    insert.status = "accepted";
    insert.original_sentences = candidate!.original_sentences;
    insert.replacement_sentences = candidate!.replacement_sentences;
  }

  const { data: created, error } = await supabase
    .from("repair_choices")
    .insert(insert)
    .select("id")
    .single();
  if (error || !created) {
    return NextResponse.json(
      { error: "save_failed", detail: error?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ choice_id: created.id, plan_id });
}
