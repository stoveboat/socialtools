import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/header";
import { GradeBadge } from "@/components/grade-badge";
import { GradeStrip, type GradeRow } from "@/components/grade-strip";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import {
  loadLatestDiagnosticAny,
  loadLatestSourceDiagnostic,
} from "@/lib/db/diagnostic";
import {
  PASS_BLURB,
  PASS_DIMENSIONS,
  PASS_LABEL,
  passesNeeded,
  type PassId,
} from "@/lib/diagnostics/passes";
import type { DimensionGrade, Grade } from "@/lib/diagnostics/types";

const GRADE_RANK: Record<Grade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };
const isWeak = (g: Grade) => g === "C" || g === "D" || g === "F";

function summarizeCounts(grades: DimensionGrade[]) {
  const tally = { A: 0, B: 0, C: 0, belowC: 0 };
  for (const g of grades) {
    if (g.grade === "A") tally.A++;
    else if (g.grade === "B") tally.B++;
    else if (g.grade === "C") tally.C++;
    else tally.belowC++;
  }
  return tally;
}

function dimensionLabel(id: string): string {
  return id
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/diagnostic/${id}/summary`);

  const { data: piece } = await supabase
    .from("pieces")
    .select("id, source_script, refined_script")
    .eq("id", id)
    .single();
  if (!piece) notFound();

  const latestDiag = await loadLatestDiagnosticAny(id);
  if (!latestDiag) {
    redirect(`/diagnostic/${id}`);
  }
  const sourceDiag = await loadLatestSourceDiagnostic(id);
  const isRefined = latestDiag.script_version === "refined";

  // User-marked "intentional" overrides — these dimensions are excluded from
  // the "needs repair" computation but still surface their grade in the
  // diagnostic for transparency.
  const { data: overrideRows } = await supabase
    .from("dimension_overrides")
    .select("dimension_id, scope, reason")
    .eq("piece_id", id);
  const overriddenIds = new Set(
    (overrideRows ?? []).map((r) => r.dimension_id),
  );
  const overrideMeta: Record<
    string,
    { scope: string; reason: string | null }
  > = {};
  for (const r of overrideRows ?? []) {
    overrideMeta[r.dimension_id] = { scope: r.scope, reason: r.reason };
  }

  const weakGrades = latestDiag.grades.filter(
    (g) => isWeak(g.grade as Grade) && !overriddenIds.has(g.dimension_id),
  );
  const passes = passesNeeded(
    latestDiag.grades.map((g) => ({
      dimension_id: g.dimension_id,
      grade: g.grade as Grade,
    })),
    overriddenIds,
  );
  const recommendedPass: PassId | null = passes[0] ?? null;

  const strengths = latestDiag.grades.filter(
    (g) => g.grade === "A" || g.grade === "B",
  );
  strengths.sort(
    (a, b) =>
      GRADE_RANK[b.grade] - GRADE_RANK[a.grade] ||
      a.dimension_name.localeCompare(b.dimension_name),
  );
  const polish = latestDiag.grades.filter((g) => g.grade === "B");

  const counts = summarizeCounts(latestDiag.grades);

  const initialStrip: GradeRow[] = sourceDiag
    ? sourceDiag.grades.map((g) => ({
        dimension_id: g.dimension_id,
        grade: g.grade as Grade,
      }))
    : [];
  const currentStrip: GradeRow[] = latestDiag.grades.map((g) => ({
    dimension_id: g.dimension_id,
    grade: g.grade as Grade,
  }));

  const currentScript =
    isRefined && piece.refined_script
      ? piece.refined_script
      : piece.source_script;

  // Map weak dims to their pass for the per-pass card preview.
  const weakByPass: Record<PassId, DimensionGrade[]> = {
    foundation: [],
    engagement_structure: [],
    surface: [],
  };
  for (const g of weakGrades) {
    for (const passId of Object.keys(PASS_DIMENSIONS) as PassId[]) {
      if (
        (PASS_DIMENSIONS[passId] as readonly string[]).includes(
          g.dimension_id,
        )
      ) {
        weakByPass[passId].push(g);
        break;
      }
    }
  }

  const ready = passes.length === 0;

  return (
    <div className="min-h-svh flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full space-y-6">
        <header className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {isRefined
              ? "Diagnostic re-run on the refined draft."
              : "Diagnostic complete."}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Overall: {latestDiag.overall_label ?? "Mixed"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {counts.A} grades at A, {counts.B} at B, {counts.C} at C,{" "}
            {counts.belowC} below C.
            {overriddenIds.size > 0 ? (
              <>
                {" · "}
                {overriddenIds.size} marked intentional ·{" "}
                <Link
                  href={`/diagnostic/${id}/details`}
                  className="underline"
                >
                  manage
                </Link>
              </>
            ) : null}
            {isRefined && piece.refined_script ? (
              <>
                {" "}
                <Link
                  href={`/repair/${latestDiag.id}/review`}
                  className="underline"
                >
                  Compare with original
                </Link>
              </>
            ) : null}
          </p>
        </header>

        {initialStrip.length > 0 ? (
          <GradeStrip initial={initialStrip} current={currentStrip} />
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[2fr_3fr]">
          <aside className="space-y-3">
            <header className="text-xs uppercase tracking-wide text-muted-foreground">
              {isRefined ? "Current script (refined)" : "Source script"}
            </header>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-muted/40 rounded-md p-4 max-h-[70vh] overflow-y-auto">
              {currentScript}
            </pre>
          </aside>

          <section className="space-y-8">
            {strengths.length > 0 ? (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Strengths
                </h2>
                <div className="flex flex-wrap gap-2">
                  {strengths.map((g) => (
                    <span
                      key={g.dimension_id}
                      className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-sm"
                    >
                      <GradeBadge
                        grade={g.grade as Grade}
                        className="h-5 min-w-5 text-xs"
                      />
                      {g.dimension_name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {polish.length > 0 ? (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Polish opportunities
                </h2>
                <ul className="space-y-2">
                  {polish.map((g) => (
                    <li
                      key={g.dimension_id}
                      className="rounded-md border p-3 text-sm space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <GradeBadge grade={g.grade as Grade} />
                        <span className="font-medium">{g.dimension_name}</span>
                      </div>
                      <p className="text-muted-foreground">{g.evidence}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!ready ? (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Required revision passes
                </h2>
                <p className="text-xs text-muted-foreground -mt-2">
                  Each pass is a coherent rewrite that addresses several
                  related dimensions together. Run them in order — Foundation
                  changes ripple through the others, so passes are recommended
                  top-down.
                </p>
                <ul className="space-y-3">
                  {passes.map((passId) => {
                    const isRecommended = passId === recommendedPass;
                    const dims = weakByPass[passId];
                    return (
                      <li
                        key={passId}
                        className={`rounded-lg border p-4 space-y-3 ${
                          isRecommended
                            ? "border-foreground bg-muted/20"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">
                                {PASS_LABEL[passId]}
                              </span>
                              {isRecommended ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-foreground/40 bg-background px-2 py-0.5 text-xs font-medium">
                                  ★ Recommended next
                                </span>
                              ) : null}
                            </div>
                            <p className="text-sm text-muted-foreground leading-snug">
                              {PASS_BLURB[passId]}
                            </p>
                          </div>
                          <Link
                            href={`/repair/${latestDiag.id}/${passId}`}
                            className="shrink-0"
                          >
                            <Button
                              size="sm"
                              variant={isRecommended ? "default" : "outline"}
                            >
                              Run this pass
                            </Button>
                          </Link>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Weak dimensions this pass addresses:{" "}
                          {dims.length > 0
                            ? dims
                                .map(
                                  (d) =>
                                    `${d.dimension_name} (${d.grade})`,
                                )
                                .join(", ")
                            : "none — already strong, but the pass is offered for any user-driven adjustments"}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div className="rounded-lg border bg-muted/20 p-5 space-y-3">
              {ready ? (
                <>
                  <p className="text-sm">
                    The script is in strong shape. You can proceed directly to
                    deriving the four formats, or run a Surface pass for a
                    polish even though no surface dimensions are weak.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href={`/convert/${id}`}>
                      <Button>Continue to derivation</Button>
                    </Link>
                    {piece.refined_script ? (
                      <Link
                        href={`/repair/${latestDiag.id}/review`}
                        className="text-sm text-muted-foreground underline"
                      >
                        Review changes vs original
                      </Link>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm">
                    The recommended next move is the highest-impact pass that
                    has weak dimensions. After each pass the script is fully
                    re-graded; come back here to pick the next pass or stop
                    when you{"'"}re satisfied.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    {recommendedPass ? (
                      <Link
                        href={`/repair/${latestDiag.id}/${recommendedPass}`}
                      >
                        <Button>Run the recommended pass</Button>
                      </Link>
                    ) : null}
                    <Link
                      href={`/decision/${id}`}
                      className="text-sm text-muted-foreground underline"
                    >
                      Override the recommendation
                    </Link>
                  </div>
                </>
              )}
            </div>

            <div>
              <Link
                href={`/diagnostic/${id}/details`}
                className="text-sm underline text-muted-foreground"
              >
                Show detailed grades and evidence →
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
