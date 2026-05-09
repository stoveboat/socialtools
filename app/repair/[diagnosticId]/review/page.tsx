import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/header";
import { createClient } from "@/lib/supabase/server";
import {
  loadLatestDiagnostic,
  loadLatestSourceDiagnostic,
} from "@/lib/db/diagnostic";
import { loadDiagnosticOwner } from "@/lib/db/repair";
import type { DimensionId, Grade } from "@/lib/diagnostics/types";
import { Comparison, type CompareGrade } from "./comparison";

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ diagnosticId: string }>;
  searchParams: Promise<{ resolved?: string; from?: string }>;
}) {
  const { diagnosticId } = await params;
  const sp = await searchParams;
  const resolvedNames = sp.resolved
    ? sp.resolved.split("|").map((s) => s.trim()).filter(Boolean)
    : [];
  const fromName = sp.from ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/repair/${diagnosticId}/review`);

  const owner = await loadDiagnosticOwner(diagnosticId, user.id);
  if (!owner) notFound();

  const { data: piece } = await supabase
    .from("pieces")
    .select("source_script, refined_script")
    .eq("id", owner.piece_id)
    .single();
  if (!piece) notFound();
  if (!piece.refined_script) {
    redirect(`/repair/${diagnosticId}/rewrite`);
  }

  const sourceDiag = await loadLatestSourceDiagnostic(owner.piece_id);
  const refinedDiag = await loadLatestDiagnostic(owner.piece_id, "refined");

  const sourceByDim = new Map(
    (sourceDiag?.grades ?? []).map((g) => [g.dimension_id, g]),
  );
  const refinedByDim = new Map(
    (refinedDiag?.grades ?? []).map((g) => [g.dimension_id, g]),
  );
  const allDimIds = new Set<DimensionId>([
    ...sourceByDim.keys(),
    ...refinedByDim.keys(),
  ]);
  const comparison: CompareGrade[] = [];
  for (const dimId of allDimIds) {
    const s = sourceByDim.get(dimId);
    const r = refinedByDim.get(dimId);
    if (!s) continue;
    comparison.push({
      dimension_id: dimId,
      dimension_name: s.dimension_name,
      source_grade: s.grade as Grade,
      refined_grade: r ? (r.grade as Grade) : null,
    });
  }

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

        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Refined script review
          </h1>
          <p className="text-sm text-muted-foreground">
            Original on the left, refined on the right. Below: how the grades
            shifted.
          </p>
        </header>

        {resolvedNames.length > 0 ? (
          <div className="rounded-md border bg-emerald-50 border-emerald-300 px-4 py-3 text-sm text-emerald-900">
            {fromName ? (
              <>
                Your fixes resolved more than expected. Fixing{" "}
                <strong>{fromName}</strong> also took care of{" "}
                {formatList(resolvedNames)}.
              </>
            ) : (
              <>You're done — all queued dimensions are no longer weak.</>
            )}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Original
            </p>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-muted/40 rounded-md p-4 max-h-[60vh] overflow-y-auto">
              {piece.source_script}
            </pre>
          </section>
          <section className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Refined
            </p>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-emerald-50/40 rounded-md p-4 max-h-[60vh] overflow-y-auto">
              {piece.refined_script}
            </pre>
          </section>
        </div>

        <Comparison
          diagnosticId={diagnosticId}
          pieceId={owner.piece_id}
          hasRefinedDiagnostic={!!refinedDiag}
          comparison={comparison}
          refinedOverall={refinedDiag?.overall_label ?? null}
        />
      </main>
    </div>
  );
}

function formatList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
