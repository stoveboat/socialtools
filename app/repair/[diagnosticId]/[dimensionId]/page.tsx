import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/header";
import { GradeBadge } from "@/components/grade-badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { loadDiagnosticOwner } from "@/lib/db/repair";
import { DIMENSION_RATIONALE } from "@/lib/diagnostics/dimension-rationale";
import type { DimensionId, Grade } from "@/lib/diagnostics/types";
import { RepairCard } from "./repair-card";

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

  const { data: thisDim } = await supabase
    .from("dimension_grades")
    .select("dimension_id, dimension_name, grade, evidence")
    .eq("diagnostic_id", diagnosticId)
    .eq("dimension_id", dimensionId)
    .single();
  if (!thisDim) notFound();

  const { data: rows } = await supabase
    .from("dimension_grades")
    .select("dimension_id, grade")
    .eq("diagnostic_id", diagnosticId);
  const weakSequence = (rows ?? [])
    .filter((r) => isWeak(r.grade))
    .sort(
      (a, b) =>
        DIMENSION_ORDER.indexOf(a.dimension_id) -
        DIMENSION_ORDER.indexOf(b.dimension_id),
    );
  const currentIdx = weakSequence.findIndex(
    (r) => r.dimension_id === dimensionId,
  );
  const total = weakSequence.length;
  const positionLabel = currentIdx >= 0 ? currentIdx + 1 : 1;
  const previous = currentIdx > 0 ? weakSequence[currentIdx - 1] : null;
  const isLast = currentIdx === total - 1 || total === 0;
  const next = !isLast && currentIdx >= 0 ? weakSequence[currentIdx + 1] : null;
  const nextHref = next
    ? `/repair/${diagnosticId}/${next.dimension_id}`
    : `/repair/${diagnosticId}/rewrite`;

  // Pre-existing choice (if user has been here before).
  const { data: planRow } = await supabase
    .from("repair_plans")
    .select("id")
    .eq("piece_id", owner.piece_id)
    .eq("diagnostic_id", diagnosticId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let preExisting: { description: string } | undefined;
  if (planRow) {
    const { data: choice } = await supabase
      .from("repair_choices")
      .select("chosen_fix, status")
      .eq("repair_plan_id", planRow.id)
      .eq("dimension_id", dimensionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (choice && choice.status !== "skipped") {
      preExisting = { description: choice.chosen_fix };
    }
  }

  const rationale =
    DIMENSION_RATIONALE[thisDim.dimension_id as DimensionId] ?? "";

  return (
    <div className="min-h-svh flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-10 max-w-6xl mx-auto w-full space-y-6">
        <Link
          href={`/diagnostic/${owner.piece_id}/summary`}
          className="text-sm underline text-muted-foreground inline-block"
        >
          ← Back to summary
        </Link>

        <div className="grid gap-8 lg:grid-cols-[2fr_3fr]">
          <aside className="space-y-4">
            <div className="flex items-center gap-3">
              <GradeBadge grade={thisDim.grade as Grade} />
              <h1 className="text-xl font-semibold">{thisDim.dimension_name}</h1>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Diagnostic evidence
              </p>
              <blockquote className="border-l-2 pl-3 text-sm leading-relaxed text-muted-foreground">
                {thisDim.evidence}
              </blockquote>
            </div>
            {rationale ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Why this matters
                </p>
                <p className="text-sm leading-relaxed">{rationale}</p>
              </div>
            ) : null}
          </aside>

          <section className="space-y-5">
            <header>
              <h2 className="text-lg font-semibold">Pick a fix</h2>
              <p className="text-sm text-muted-foreground">
                Two to four targeted options. Each one shows the exact text
                that would change.
              </p>
            </header>

            <RepairCard
              diagnosticId={diagnosticId}
              dimensionId={dimensionId}
              nextHref={nextHref}
              preExisting={preExisting}
            />

            <div className="flex items-center justify-between border-t pt-4 text-sm">
              <div className="text-muted-foreground">
                {positionLabel} of {total}
              </div>
              <div className="flex gap-3">
                {previous ? (
                  <Link
                    href={`/repair/${diagnosticId}/${previous.dimension_id}`}
                  >
                    <Button variant="outline" size="sm">
                      Previous
                    </Button>
                  </Link>
                ) : null}
                <Link href={nextHref}>
                  <Button variant="outline" size="sm">
                    {isLast ? "Review edits" : "Next"}
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
