"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GradeBadge } from "@/components/grade-badge";
import type { Grade } from "@/lib/diagnostics/types";

export interface CompareGrade {
  dimension_id: string;
  dimension_name: string;
  source_grade: Grade;
  refined_grade: Grade | null;
}

interface ComparisonProps {
  diagnosticId: string;
  pieceId: string;
  hasRefinedDiagnostic: boolean;
  comparison: CompareGrade[];
  refinedOverall: string | null;
}

const RANK: Record<Grade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };

export function Comparison({
  diagnosticId,
  pieceId,
  hasRefinedDiagnostic,
  comparison,
  refinedOverall,
}: ComparisonProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const runRefinedDiagnostic = async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/diagnostic/${pieceId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script_version: "refined" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setRunning(false);
      startedRef.current = false;
    }
  };

  // Auto-trigger if we don't have one yet.
  useEffect(() => {
    if (!hasRefinedDiagnostic) {
      runRefinedDiagnostic();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const discard = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/repair/${diagnosticId}/discard`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `HTTP ${res.status}`);
      }
      router.push(`/diagnostic/${pieceId}/summary`);
    } catch (err) {
      setError((err as Error).message);
      setRunning(false);
    }
  };

  if (!hasRefinedDiagnostic) {
    return (
      <div className="rounded-lg border p-5 space-y-3 text-center">
        {running ? (
          <>
            <div className="h-8 w-8 mx-auto rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">
              Re-running the diagnostic on the refined script...
            </p>
          </>
        ) : (
          <>
            <p className="text-sm">
              The refined script hasn't been graded yet. Re-running takes ~30
              seconds.
            </p>
            <Button onClick={runRefinedDiagnostic}>
              Run diagnostic on refined script
            </Button>
          </>
        )}
        {error ? (
          <p
            role="alert"
            className="text-sm rounded-md bg-red-50 text-red-900 px-3 py-2"
          >
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const improved = comparison.filter(
    (c) => c.refined_grade && RANK[c.refined_grade] > RANK[c.source_grade],
  ).length;
  const regressed = comparison.filter(
    (c) => c.refined_grade && RANK[c.refined_grade] < RANK[c.source_grade],
  ).length;
  const same = comparison.length - improved - regressed;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Refined diagnostic
            </p>
            <p className="text-lg font-semibold">
              Overall: {refinedOverall ?? "Unknown"}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {improved} improved · {same} unchanged · {regressed} regressed
          </p>
        </div>

        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left pb-2">Dimension</th>
              <th className="pb-2">Source</th>
              <th className="pb-2">Refined</th>
              <th className="pb-2 text-right">Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {comparison.map((c) => {
              const delta =
                c.refined_grade
                  ? RANK[c.refined_grade] - RANK[c.source_grade]
                  : 0;
              return (
                <tr key={c.dimension_id}>
                  <td className="py-2">{c.dimension_name}</td>
                  <td className="py-2 text-center">
                    <GradeBadge
                      grade={c.source_grade}
                      className="h-5 min-w-5 text-xs"
                    />
                  </td>
                  <td className="py-2 text-center">
                    {c.refined_grade ? (
                      <GradeBadge
                        grade={c.refined_grade}
                        className="h-5 min-w-5 text-xs"
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td
                    className={`py-2 text-right ${
                      delta > 0
                        ? "text-emerald-700"
                        : delta < 0
                          ? "text-red-700"
                          : "text-muted-foreground"
                    }`}
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error ? (
        <p
          role="alert"
          className="text-sm rounded-md bg-red-50 text-red-900 px-3 py-2"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => router.push(`/convert/${pieceId}`)}>
          Continue to derivation
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push(`/repair/${diagnosticId}`)}
        >
          Go back and edit more
        </Button>
        <Button variant="outline" onClick={discard} disabled={running}>
          {running ? "Discarding..." : "Discard refinement and use original"}
        </Button>
      </div>
    </div>
  );
}
