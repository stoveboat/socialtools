import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/header";
import { GradeBadge } from "@/components/grade-badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { loadLatestSourceDiagnostic } from "@/lib/db/diagnostic";
import type { Grade } from "@/lib/diagnostics/types";

const GRADE_RANK: Record<Grade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };

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

export default async function DetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/diagnostic/${id}/details`);

  const { data: piece } = await supabase
    .from("pieces")
    .select("id")
    .eq("id", id)
    .single();
  if (!piece) notFound();

  const diag = await loadLatestSourceDiagnostic(id);
  if (!diag) redirect(`/diagnostic/${id}`);

  // Order in spec: foundation first, then execution.
  const grades = diag.grades.slice().sort((a, b) => {
    const aIdx = DIMENSION_ORDER.indexOf(a.dimension_id);
    const bIdx = DIMENSION_ORDER.indexOf(b.dimension_id);
    return aIdx - bIdx;
  });

  const counts = grades.reduce(
    (acc, g) => {
      if (g.grade === "A") acc.A++;
      else if (g.grade === "B") acc.B++;
      else if (g.grade === "C") acc.C++;
      else acc.belowC++;
      return acc;
    },
    { A: 0, B: 0, C: 0, belowC: 0 },
  );

  return (
    <div className="min-h-svh flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-10 max-w-3xl mx-auto w-full space-y-8">
        <div>
          <Link
            href={`/diagnostic/${id}/summary`}
            className="text-sm underline text-muted-foreground"
          >
            ← Back to summary
          </Link>
        </div>

        <header className="space-y-2">
          <p className="text-sm text-muted-foreground">All eleven grades.</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Overall: {diag.overall_label ?? "Mixed"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {counts.A} grades at A, {counts.B} at B, {counts.C} at C,{" "}
            {counts.belowC} below C.
          </p>
        </header>

        <ul className="space-y-3">
          {grades.map((g) => {
            const weak = GRADE_RANK[g.grade] <= 2;
            return (
              <li
                key={g.dimension_id}
                className="rounded-lg border p-5 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <GradeBadge grade={g.grade} />
                    <h2 className="font-semibold">{g.dimension_name}</h2>
                  </div>
                  {weak ? (
                    <Link href={`/repair/${diag.id}/${g.dimension_id}`}>
                      <Button size="sm" variant="outline">
                        Fix this
                      </Button>
                    </Link>
                  ) : (
                    <span className="text-emerald-700 text-sm">✓ solid</span>
                  )}
                </div>
                <blockquote className="border-l-2 pl-3 text-sm leading-relaxed text-muted-foreground">
                  {g.evidence}
                </blockquote>
                {g.repair_suggestion ? (
                  <p className="text-sm">
                    <span className="font-medium">Suggested repair: </span>
                    {g.repair_suggestion}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
