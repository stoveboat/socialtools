import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/header";
import { GradeBadge } from "@/components/grade-badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { loadLatestSourceDiagnostic } from "@/lib/db/diagnostic";
import type { DimensionGrade, Grade } from "@/lib/diagnostics/types";

const GRADE_RANK: Record<Grade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };

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

interface RoutingCopy {
  blurb: string;
  primaryLabel: string;
  primaryHref: (pieceId: string, diagId: string) => string;
}

const ROUTING_COPY: Record<string, RoutingCopy> = {
  ready_to_ship: {
    blurb:
      "Your script is in strong shape. You can proceed directly to deriving the four formats, or polish the B grades first.",
    primaryLabel: "Continue to derivation",
    primaryHref: (pieceId) => `/convert/${pieceId}`,
  },
  surgical_repair: {
    blurb:
      "Your script has dimensions that need attention. The fixes are targeted — they should take 10-15 minutes.",
    primaryLabel: "Start repairs",
    primaryHref: (_pieceId, diagId) => `/repair/${diagId}`,
  },
  skeleton_mode: {
    blurb:
      "Your script has structural issues that go beyond line-by-line repair. Skeleton Mode rebuilds around the strongest seed in your draft.",
    primaryLabel: "Run Skeleton Mode",
    primaryHref: (pieceId) => `/skeleton/${pieceId}`,
  },
  back_to_phase_0: {
    blurb:
      "Your script doesn't have a clear foundation yet. The strongest path is to clarify intent and start a fresh draft.",
    primaryLabel: "Start a fresh draft",
    primaryHref: () => `/`,
  },
};

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
    .select("id")
    .eq("id", id)
    .single();
  if (!piece) notFound();

  const diag = await loadLatestSourceDiagnostic(id);
  if (!diag) {
    // No grades yet — bounce back to the loading screen, which will trigger
    // the run.
    redirect(`/diagnostic/${id}`);
  }

  const grades = diag.grades.slice().sort((a, b) => {
    const rankDiff = GRADE_RANK[b.grade] - GRADE_RANK[a.grade];
    if (rankDiff !== 0) return rankDiff;
    return a.dimension_name.localeCompare(b.dimension_name);
  });
  const strengths = grades.filter((g) => g.grade === "A" || g.grade === "B");
  const polish = grades.filter((g) => g.grade === "B");
  const repairs = grades.filter(
    (g) => g.grade === "C" || g.grade === "D" || g.grade === "F",
  );
  const counts = summarizeCounts(grades);
  const routing =
    ROUTING_COPY[diag.routing_recommendation ?? "surgical_repair"] ??
    ROUTING_COPY.surgical_repair;

  return (
    <div className="min-h-svh flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-10 max-w-3xl mx-auto w-full space-y-10">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground">Diagnostic complete.</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Overall: {diag.overall_label ?? "Mixed"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {counts.A} grades at A, {counts.B} at B, {counts.C} at C,{" "}
            {counts.belowC} below C.
          </p>
        </header>

        {strengths.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Strengths
            </h2>
            <div className="flex flex-wrap gap-2">
              {strengths.map((g) => (
                <span
                  key={g.dimension_id}
                  className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-sm"
                >
                  <GradeBadge grade={g.grade} className="h-5 min-w-5 text-xs" />
                  {g.dimension_name}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {polish.length > 0 ? (
          <section className="space-y-3">
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
                    <GradeBadge grade={g.grade} />
                    <span className="font-medium">{g.dimension_name}</span>
                  </div>
                  <p className="text-muted-foreground">{g.evidence}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {repairs.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Required repairs
            </h2>
            <ul className="space-y-3">
              {repairs.map((g) => (
                <li
                  key={g.dimension_id}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <GradeBadge grade={g.grade} />
                      <span className="font-semibold">{g.dimension_name}</span>
                    </div>
                    <Link
                      href={`/repair/${diag.id}/${g.dimension_id}`}
                      className="shrink-0"
                    >
                      <Button size="sm" variant="outline">
                        Fix this
                      </Button>
                    </Link>
                  </div>
                  <p className="text-sm leading-relaxed">{g.evidence}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-lg border bg-muted/20 p-5 space-y-3">
          <p className="text-sm">{routing.blurb}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href={routing.primaryHref(id, diag.id)}>
              <Button>{routing.primaryLabel}</Button>
            </Link>
            <Link
              href={`/decision/${id}`}
              className="text-sm text-muted-foreground underline"
            >
              Override the recommendation
            </Link>
          </div>
        </section>

        <div className="text-center">
          <Link
            href={`/diagnostic/${id}/details`}
            className="text-sm underline text-muted-foreground"
          >
            Show detailed grades and evidence →
          </Link>
        </div>
      </main>
    </div>
  );
}
