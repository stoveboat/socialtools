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
import { orderByPosition } from "@/lib/diagnostics/repair-order";
import type { DimensionGrade, Grade } from "@/lib/diagnostics/types";

const GRADE_RANK: Record<Grade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };
const isWeak = (g: Grade) =>
  g === "C" || g === "D" || g === "F";

interface RoutingCopy {
  blurb: string;
  primaryLabel: string;
  primaryHref: (pieceId: string, diagId: string) => string;
}

const ROUTING_COPY: Record<string, RoutingCopy> = {
  ready_to_ship: {
    blurb:
      "The script is in strong shape. You can proceed directly to deriving the four formats, or polish the B grades first.",
    primaryLabel: "Continue to derivation",
    primaryHref: (pieceId) => `/convert/${pieceId}`,
  },
  surgical_repair: {
    blurb:
      "Targeted repairs will get this to ready. Pick the recommended fix below to start, or jump to any weak dimension.",
    primaryLabel: "Fix the recommended one",
    primaryHref: (_pieceId, diagId) => `/repair/${diagId}`,
  },
  skeleton_mode: {
    blurb:
      "The script has structural issues that go beyond line-by-line repair. Skeleton Mode rebuilds around the strongest seed in your draft.",
    primaryLabel: "Run Skeleton Mode",
    primaryHref: (pieceId) => `/skeleton/${pieceId}`,
  },
  back_to_phase_0: {
    blurb:
      "Foundation grades are weak across the board. The strongest path is to clarify intent and start a fresh draft.",
    primaryLabel: "Start a fresh draft",
    primaryHref: () => `/`,
  },
};

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

  // Latest = whichever diagnostic was last persisted (refined if any fix has
  // landed, else source). The Summary always reflects the current state.
  const latestDiag = await loadLatestDiagnosticAny(id);
  if (!latestDiag) {
    // No grades yet — bounce back to the loading screen, which will trigger
    // the run.
    redirect(`/diagnostic/${id}`);
  }
  const sourceDiag = await loadLatestSourceDiagnostic(id);
  const isRefined = latestDiag.script_version === "refined";

  // Order weak dims by where in the script the fix lands (Hook → Payoff).
  // The first one becomes the "recommended next" highlight.
  const weakInOrder = orderByPosition(
    latestDiag.grades.filter((g) => isWeak(g.grade as Grade)),
  );
  const recommendedDimId = weakInOrder[0]?.dimension_id ?? null;

  // For Strengths / Polish: simple grade rank ordering.
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
  const routing =
    ROUTING_COPY[latestDiag.routing_recommendation ?? "surgical_repair"] ??
    ROUTING_COPY.surgical_repair;

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

            {weakInOrder.length > 0 ? (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Required repairs · ordered top to bottom of script
                </h2>
                <ul className="space-y-3">
                  {weakInOrder.map((g) => {
                    const isRecommended =
                      g.dimension_id === recommendedDimId;
                    return (
                      <li
                        key={g.dimension_id}
                        className={`rounded-lg border p-4 space-y-3 ${
                          isRecommended
                            ? "border-foreground bg-muted/20"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <GradeBadge grade={g.grade as Grade} />
                            <span className="font-semibold">
                              {g.dimension_name}
                            </span>
                            {isRecommended ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-foreground/40 bg-background px-2 py-0.5 text-xs font-medium">
                                ★ Recommended next
                              </span>
                            ) : null}
                          </div>
                          <Link
                            href={`/repair/${latestDiag.id}/${g.dimension_id}`}
                            className="shrink-0"
                          >
                            <Button
                              size="sm"
                              variant={isRecommended ? "default" : "outline"}
                            >
                              Fix this
                            </Button>
                          </Link>
                        </div>
                        <p className="text-sm leading-relaxed">{g.evidence}</p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div className="rounded-lg border bg-muted/20 p-5 space-y-3">
              <p className="text-sm">{routing.blurb}</p>
              <div className="flex flex-wrap items-center gap-3">
                <Link href={routing.primaryHref(id, latestDiag.id)}>
                  <Button>{routing.primaryLabel}</Button>
                </Link>
                {weakInOrder.length === 0 && piece.refined_script ? (
                  <Link
                    href={`/repair/${latestDiag.id}/review`}
                    className="text-sm text-muted-foreground underline"
                  >
                    Review changes vs original
                  </Link>
                ) : null}
                <Link
                  href={`/decision/${id}`}
                  className="text-sm text-muted-foreground underline"
                >
                  Override the recommendation
                </Link>
              </div>
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
