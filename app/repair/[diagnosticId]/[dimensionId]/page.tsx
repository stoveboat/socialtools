import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/header";
import { GradeStrip, type GradeRow } from "@/components/grade-strip";
import { createClient } from "@/lib/supabase/server";
import { loadDiagnosticOwner } from "@/lib/db/repair";
import { DIMENSION_RATIONALE } from "@/lib/diagnostics/dimension-rationale";
import {
  computeQueue,
  getTier,
  getTierLabel,
} from "@/lib/diagnostics/repair-order";
import type { DimensionId, Grade } from "@/lib/diagnostics/types";
import { RepairCard } from "./repair-card";

export default async function RepairCardPage({
  params,
}: {
  params: Promise<{ diagnosticId: string; dimensionId: string }>;
}) {
  const { diagnosticId, dimensionId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    redirect(`/login?next=/repair/${diagnosticId}/${dimensionId}`);

  const owner = await loadDiagnosticOwner(diagnosticId, user.id);
  if (!owner) notFound();

  // Initial grades come from the source diagnostic (the one in the URL).
  const { data: initialRows } = await supabase
    .from("dimension_grades")
    .select("dimension_id, dimension_name, grade")
    .eq("diagnostic_id", diagnosticId);

  // Latest grades come from whichever diagnostic is most recent for the
  // piece - the refined diagnostic if any fix has landed, else the source.
  const { data: latestDiag } = await supabase
    .from("diagnostics")
    .select("id, script_version")
    .eq("piece_id", owner.piece_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestDiagId = latestDiag?.id ?? diagnosticId;
  const { data: latestRows } = await supabase
    .from("dimension_grades")
    .select("dimension_id, dimension_name, grade")
    .eq("diagnostic_id", latestDiagId);

  const thisDim = (latestRows ?? []).find(
    (r) => r.dimension_id === dimensionId,
  );
  if (!thisDim) notFound();

  // Compute the queue against latest grades, exclude addressed.
  const { data: planRow } = await supabase
    .from("repair_plans")
    .select("id")
    .eq("piece_id", owner.piece_id)
    .eq("diagnostic_id", diagnosticId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let addressed = new Set<string>();
  if (planRow) {
    const { data: choices } = await supabase
      .from("repair_choices")
      .select("dimension_id, status")
      .eq("repair_plan_id", planRow.id);
    addressed = new Set(
      (choices ?? [])
        .filter((c) =>
          ["accepted", "edited", "skipped", "auto_resolved"].includes(c.status),
        )
        .map((c) => c.dimension_id),
    );
  }
  // The current dim is "in the queue" even if a stale choice exists for it.
  addressed.delete(dimensionId);
  const queue = computeQueue(latestRows ?? [], addressed);
  const positionLabel = queue.findIndex((q) => q.dimension_id === dimensionId) + 1;
  const total = queue.length;

  const initial: GradeRow[] = (initialRows ?? []).map((r) => ({
    dimension_id: r.dimension_id,
    grade: r.grade as Grade,
  }));
  const current: GradeRow[] = (latestRows ?? []).map((r) => ({
    dimension_id: r.dimension_id,
    grade: r.grade as Grade,
  }));

  const rationale =
    DIMENSION_RATIONALE[thisDim.dimension_id as DimensionId] ?? "";

  return (
    <div className="min-h-svh flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-6 max-w-6xl mx-auto w-full space-y-5">
        <Link
          href={`/diagnostic/${owner.piece_id}/summary`}
          className="text-sm underline text-muted-foreground inline-block"
        >
          ← Back to summary
        </Link>

        <GradeStrip
          initial={initial}
          current={current}
          highlightDimensionId={dimensionId}
        />

        <div className="grid gap-8 lg:grid-cols-[2fr_3fr]">
          <aside className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Tier {getTier(dimensionId).tier} ·{" "}
                {getTierLabel(dimensionId)}
              </p>
              <h1 className="text-xl font-semibold">{thisDim.dimension_name}</h1>
            </div>
            {rationale ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Why this matters
                </p>
                <p className="text-sm leading-relaxed">{rationale}</p>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground border-t pt-3">
              The strip above is regraded after every fix. Fixes are ordered by
              dependency tier — Foundation first (Spine, Audience,
              Positioning), then Engagement Architecture, then Structural
              Execution, then Surface Execution. Higher tiers reshape what
              lower tiers need to do.
            </p>
          </aside>

          <section className="space-y-5">
            <header>
              <h2 className="text-lg font-semibold">Pick a fix</h2>
              <p className="text-sm text-muted-foreground">
                Two to four targeted options against the current draft. Edit
                the replacement before applying if the wording isn't quite
                right.
              </p>
            </header>

            <RepairCard
              diagnosticId={diagnosticId}
              pieceId={owner.piece_id}
              dimensionId={dimensionId}
            />

            <p className="border-t pt-4 text-sm text-muted-foreground">
              {total > 0 ? `${positionLabel} of ${total} remaining` : ""}
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
