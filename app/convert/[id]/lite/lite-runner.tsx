"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GradeBadge } from "@/components/grade-badge";
import type { LiteDiagnosticVerdict } from "@/lib/diagnostics/types";

const STATUS_MESSAGES = [
  "Reading your script...",
  "Grading spine clarity...",
  "Grading audience specificity...",
  "Grading tension presence...",
  "Grading payoff specificity...",
  "Grading authority...",
];

export function LiteRunner({ pieceId }: { pieceId: string }) {
  const [statusIdx, setStatusIdx] = useState(0);
  const [verdict, setVerdict] = useState<LiteDiagnosticVerdict | null>(null);
  const [grades, setGrades] = useState<{ dimension_name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const interval = setInterval(() => {
      setStatusIdx((i) => Math.min(i + 1, STATUS_MESSAGES.length - 1));
    }, 1800);

    (async () => {
      try {
        const res = await fetch(`/api/lite-diagnostic/${pieceId}`, {
          method: "POST",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || body.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        clearInterval(interval);
        setVerdict(data.verdict);
        setGrades(data.grades);
      } catch (err) {
        clearInterval(interval);
        setError((err as Error).message);
      }
    })();

    return () => clearInterval(interval);
  }, [pieceId]);

  if (error) {
    return (
      <p
        role="alert"
        className="text-sm rounded-md bg-red-50 text-red-900 px-3 py-2"
      >
        {error}
      </p>
    );
  }

  if (!verdict) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="h-10 w-10 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
        <p className="text-sm text-muted-foreground">
          {STATUS_MESSAGES[statusIdx]}
        </p>
        <p className="text-xs text-muted-foreground">
          The Lite Diagnostic checks the five foundation grades. ~10 seconds.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className={`rounded-lg border p-5 ${
          verdict.level === "ready"
            ? "bg-emerald-50 border-emerald-300"
            : verdict.level === "single_weakness"
              ? "bg-amber-50 border-amber-300"
              : "bg-red-50 border-red-300"
        }`}
      >
        <p className="text-sm leading-relaxed">{verdict.message}</p>

        {verdict.weak_dimensions.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {verdict.weak_dimensions.map((w) => (
              <li
                key={w.dimension_id}
                className="text-sm flex items-start gap-2"
              >
                <GradeBadge grade={w.grade} className="h-5 min-w-5 text-xs" />
                <span className="leading-snug">{w.evidence}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/convert/${pieceId}`}>
          <Button>
            {verdict.level === "ready"
              ? "Continue to derivation"
              : "Proceed anyway"}
          </Button>
        </Link>
        {verdict.level !== "ready" ? (
          <Link
            href={`/diagnostic/${pieceId}`}
            className="text-sm underline text-muted-foreground"
          >
            Run the full diagnostic and refine first
          </Link>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Lite Diagnostic checked {grades.length} foundation grades.
      </p>
    </div>
  );
}
