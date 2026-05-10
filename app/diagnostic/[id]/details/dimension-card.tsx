"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GradeBadge } from "@/components/grade-badge";
import { Textarea } from "@/components/ui/textarea";
import type { Grade } from "@/lib/diagnostics/types";

export interface DimensionCardProps {
  pieceId: string;
  diagnosticId: string;
  dimensionId: string;
  dimensionName: string;
  grade: Grade;
  evidence: string;
  repairSuggestion: string;
  passHref: string | null;
  override:
    | { scope: "piece" | "pass"; reason: string | null }
    | null;
}

export function DimensionCard({
  pieceId,
  dimensionId,
  dimensionName,
  grade,
  evidence,
  repairSuggestion,
  passHref,
  override,
}: DimensionCardProps) {
  const router = useRouter();
  const isWeak = grade === "C" || grade === "D" || grade === "F";
  const [showForm, setShowForm] = useState(false);
  const [scope, setScope] = useState<"piece" | "pass">("piece");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markIntentional = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/dimension-overrides/${pieceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dimension_id: dimensionId,
          scope,
          reason: reason.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `HTTP ${res.status}`);
      }
      setShowForm(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  const removeOverride = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/dimension-overrides/${pieceId}?dimension_id=${encodeURIComponent(
          dimensionId,
        )}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <li
      className={`rounded-lg border p-5 space-y-3 ${
        override ? "bg-muted/30" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <GradeBadge grade={grade} />
          <h2 className="font-semibold">{dimensionName}</h2>
          {override ? (
            <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs">
              ✓ Marked intentional
              {override.scope === "pass" ? " (this pass only)" : ""}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {!override && isWeak && passHref ? (
            <Link href={passHref}>
              <Button size="sm" variant="outline">
                Fix in pass
              </Button>
            </Link>
          ) : null}
          {!override && !isWeak ? (
            <span className="text-emerald-700 text-sm">✓ solid</span>
          ) : null}
          {override ? (
            <Button
              size="sm"
              variant="outline"
              onClick={removeOverride}
              disabled={pending}
            >
              Remove override
            </Button>
          ) : null}
        </div>
      </div>

      <blockquote className="border-l-2 pl-3 text-sm leading-relaxed text-muted-foreground">
        {evidence}
      </blockquote>
      {repairSuggestion ? (
        <p className="text-sm">
          <span className="font-medium">Suggested repair: </span>
          {repairSuggestion}
        </p>
      ) : null}

      {override?.reason ? (
        <p className="text-xs text-muted-foreground italic">
          Your note: {override.reason}
        </p>
      ) : null}

      {!override && isWeak ? (
        <div className="border-t pt-3">
          {showForm ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Why is this dimension intentional?
                </p>
                <p className="text-xs text-muted-foreground">
                  Mark this when the grader is wrong about this being a
                  problem — e.g. vague language is the rhetorical point of a
                  permission piece, or a structural choice is deliberate.
                  The grade stays in the diagnostic for transparency but
                  this dimension stops being surfaced as needing repair.
                </p>
              </div>
              <Textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Optional. Note for yourself, e.g. 'permission payoffs need vague language'."
              />
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Scope
                </p>
                <div className="flex flex-wrap gap-2 text-sm">
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      name={`scope-${dimensionId}`}
                      value="piece"
                      checked={scope === "piece"}
                      onChange={() => setScope("piece")}
                    />
                    Whole piece (persists)
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      name={`scope-${dimensionId}`}
                      value="pass"
                      checked={scope === "pass"}
                      onChange={() => setScope("pass")}
                    />
                    This pass only (auto-clears on next pass)
                  </label>
                </div>
              </div>
              {error ? (
                <p
                  role="alert"
                  className="text-sm rounded-md bg-red-50 text-red-900 px-3 py-2"
                >
                  {error}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={markIntentional}
                  disabled={pending}
                >
                  {pending ? "Saving..." : "Mark intentional"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="text-sm underline text-muted-foreground"
            >
              The grader is wrong about this — mark intentional
            </button>
          )}
        </div>
      ) : null}
    </li>
  );
}
