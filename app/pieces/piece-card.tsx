"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GradeBadge } from "@/components/grade-badge";
import type { Grade } from "@/lib/diagnostics/types";

export interface PieceCardProps {
  id: string;
  title: string;
  wordCount: number;
  estimatedSeconds: number;
  updatedRelative: string;
  phaseLabel: string;
  resumeHref: string;
  resumeLabel: string;
  overallLabel: string | null;
  representativeGrade: Grade | null;
  scriptVersion: "source" | "refined" | null;
}

export function PieceCard(props: PieceCardProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (
      !confirm(
        `Delete "${props.title}"? This permanently removes the piece and every diagnostic, refinement, and brief tied to it.`,
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/pieces/${props.id}/delete`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  };

  return (
    <li className="rounded-lg border p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1 flex-1 min-w-0">
          <h2 className="font-medium leading-snug">{props.title}</h2>
          <p className="text-xs text-muted-foreground">
            {props.phaseLabel} · {props.wordCount} words · ~
            {props.estimatedSeconds}s · {props.updatedRelative}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {props.representativeGrade ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs">
              <GradeBadge
                grade={props.representativeGrade}
                className="h-5 min-w-5 text-xs px-1.5"
              />
              {props.overallLabel}
              {props.scriptVersion === "refined" ? " · refined" : null}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Not graded</span>
          )}
          <Link href={props.resumeHref}>
            <Button size="sm">{props.resumeLabel}</Button>
          </Link>
          <Button
            size="sm"
            variant="outline"
            onClick={remove}
            disabled={pending}
          >
            {pending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
      {error ? (
        <p
          role="alert"
          className="text-xs rounded-md bg-red-50 text-red-900 px-3 py-2"
        >
          {error}
        </p>
      ) : null}
    </li>
  );
}
