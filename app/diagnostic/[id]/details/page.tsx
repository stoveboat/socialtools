import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/header";
import { createClient } from "@/lib/supabase/server";
import { loadLatestDiagnosticAny } from "@/lib/db/diagnostic";
import {
  PASS_DIMENSIONS,
  type PassId,
} from "@/lib/diagnostics/passes";
import type { DimensionId, Grade } from "@/lib/diagnostics/types";
import { DimensionCard } from "./dimension-card";

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

function passForDimension(dimId: string): PassId | null {
  for (const passId of Object.keys(PASS_DIMENSIONS) as PassId[]) {
    if ((PASS_DIMENSIONS[passId] as readonly string[]).includes(dimId)) {
      return passId;
    }
  }
  return null;
}

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

  const diag = await loadLatestDiagnosticAny(id);
  if (!diag) redirect(`/diagnostic/${id}`);

  const { data: overrideRows } = await supabase
    .from("dimension_overrides")
    .select("dimension_id, scope, reason")
    .eq("piece_id", id);
  const overrideMap = new Map<
    string,
    { scope: "piece" | "pass"; reason: string | null }
  >();
  for (const r of overrideRows ?? []) {
    overrideMap.set(r.dimension_id, {
      scope: r.scope as "piece" | "pass",
      reason: r.reason,
    });
  }

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
            {overrideMap.size > 0 ? (
              <> · {overrideMap.size} marked intentional</>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground">
            If the grader is wrong about a dimension being weak — common for
            calibration mismatches like vague language in a permission piece
            — mark it intentional. The grade stays in the diagnostic for
            transparency, but the dimension stops being surfaced as needing
            repair.
          </p>
        </header>

        <ul className="space-y-3">
          {grades.map((g) => {
            const passId = passForDimension(g.dimension_id);
            const passHref = passId
              ? `/repair/${diag.id}/${passId}`
              : null;
            return (
              <DimensionCard
                key={g.dimension_id}
                pieceId={id}
                diagnosticId={diag.id}
                dimensionId={g.dimension_id as DimensionId}
                dimensionName={g.dimension_name}
                grade={g.grade as Grade}
                evidence={g.evidence}
                repairSuggestion={g.repair_suggestion ?? ""}
                passHref={passHref}
                override={overrideMap.get(g.dimension_id) ?? null}
              />
            );
          })}
        </ul>
      </main>
    </div>
  );
}
