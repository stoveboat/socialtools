import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/header";
import { createClient } from "@/lib/supabase/server";
import { loadDiagnosticOwner } from "@/lib/db/repair";
import { DIMENSION_RATIONALE } from "@/lib/diagnostics/dimension-rationale";
import type { DimensionId } from "@/lib/diagnostics/types";
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
  searchParams,
}: {
  params: Promise<{ diagnosticId: string; dimensionId: string }>;
  searchParams: Promise<{ resolved?: string; from?: string }>;
}) {
  const { diagnosticId, dimensionId } = await params;
  const { resolved, from } = await searchParams;

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
    .select("dimension_id, dimension_name")
    .eq("diagnostic_id", diagnosticId)
    .eq("dimension_id", dimensionId)
    .single();
  if (!thisDim) notFound();

  // Determine the user's position in the queue. Queue = initial weak dims
  // that don't yet have a repair_choice. We surface the position of the
  // current dim plus the total queue length for the "[N] of [M]" indicator.
  const { data: rows } = await supabase
    .from("dimension_grades")
    .select("dimension_id, grade")
    .eq("diagnostic_id", diagnosticId);
  const initialWeak = (rows ?? [])
    .filter((r) => isWeak(r.grade))
    .map((r) => r.dimension_id);

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
      .select("dimension_id")
      .eq("repair_plan_id", planRow.id);
    addressed = new Set((choices ?? []).map((c) => c.dimension_id));
  }
  // The current dim is "in the queue" even if a repair_choice already exists
  // (the user revisited it).
  addressed.delete(dimensionId);

  const queue = initialWeak
    .filter((id) => !addressed.has(id))
    .sort(
      (a, b) => DIMENSION_ORDER.indexOf(a) - DIMENSION_ORDER.indexOf(b),
    );
  const positionLabel = queue.indexOf(dimensionId) + 1;
  const total = queue.length;

  const rationale =
    DIMENSION_RATIONALE[thisDim.dimension_id as DimensionId] ?? "";

  const resolvedNames = resolved
    ? resolved.split("|").map((s) => s.trim()).filter(Boolean)
    : [];

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

        {resolvedNames.length > 0 ? (
          <div className="rounded-md border bg-emerald-50 border-emerald-300 px-4 py-3 text-sm text-emerald-900">
            {from ? (
              <>
                Fixing <strong>{from}</strong> also resolved{" "}
                {formatList(resolvedNames)}. Skipping{" "}
                {resolvedNames.length === 1 ? "it" : "them"}.
              </>
            ) : (
              <>
                Resolved on the side: {formatList(resolvedNames)}.
              </>
            )}
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[2fr_3fr]">
          <aside className="space-y-4">
            <h1 className="text-xl font-semibold">{thisDim.dimension_name}</h1>
            {rationale ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Why this matters
                </p>
                <p className="text-sm leading-relaxed">{rationale}</p>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground border-t pt-3">
              The grader re-reads the latest version of your script for each
              card, so what shows up here is always against the current draft —
              not the original diagnostic.
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
              dimensionName={thisDim.dimension_name}
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

function formatList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
