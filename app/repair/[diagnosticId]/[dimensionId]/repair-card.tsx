"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { FixCandidate } from "@/lib/diagnostics/repair";

interface RepairCardProps {
  diagnosticId: string;
  dimensionId: string;
  nextHref: string;
  preExisting?: { description: string };
}

export function RepairCard({
  diagnosticId,
  dimensionId,
  nextHref,
  preExisting,
}: RepairCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<FixCandidate[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/repair/${diagnosticId}/${dimensionId}/candidates`,
          { method: "POST" },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || body.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (cancelled) return;
        setCandidates(data.candidates);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [diagnosticId, dimensionId]);

  const submit = async (action: "pick" | "skip") => {
    setSubmitting(true);
    setError(null);
    try {
      const body =
        action === "skip"
          ? { skipped: true }
          : { candidate: candidates[Number(selectedIdx)] };
      const res = await fetch(
        `/api/repair/${diagnosticId}/${dimensionId}/choice`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          errBody.detail || errBody.error || `HTTP ${res.status}`,
        );
      }
      router.push(nextHref);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="h-8 w-8 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
        <p className="text-sm text-muted-foreground">
          Generating fix candidates...
        </p>
      </div>
    );
  }

  if (error && candidates.length === 0) {
    return (
      <p
        role="alert"
        className="text-sm rounded-md bg-red-50 text-red-900 px-3 py-2"
      >
        {error}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {preExisting ? (
        <p className="text-xs rounded-md bg-emerald-50 text-emerald-900 px-3 py-2">
          You already picked: <strong>{preExisting.description}</strong>.
          Picking again will replace the previous choice.
        </p>
      ) : null}

      <RadioGroup
        value={selectedIdx}
        onValueChange={setSelectedIdx}
        className="space-y-3"
      >
        {candidates.map((c, i) => (
          <Label
            key={i}
            htmlFor={`candidate-${i}`}
            className={`block rounded-md border p-4 cursor-pointer transition ${
              String(i) === selectedIdx
                ? "border-foreground bg-muted/40"
                : "hover:bg-muted/20"
            }`}
          >
            <div className="flex items-start gap-3">
              <RadioGroupItem
                value={String(i)}
                id={`candidate-${i}`}
                className="mt-1"
              />
              <div className="space-y-3 flex-1">
                <p className="font-medium leading-tight">{c.description}</p>
                <DiffPreview
                  original={c.original_sentences.join(" ")}
                  replacement={c.replacement_sentences.join(" ")}
                />
              </div>
            </div>
          </Label>
        ))}
      </RadioGroup>

      {error ? (
        <p
          role="alert"
          className="text-sm rounded-md bg-red-50 text-red-900 px-3 py-2"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => submit("pick")}
          disabled={selectedIdx === "" || submitting}
        >
          {submitting ? "Saving..." : "Pick this fix"}
        </Button>
        <Button
          variant="outline"
          onClick={() => submit("skip")}
          disabled={submitting}
        >
          Skip this dimension
        </Button>
      </div>
    </div>
  );
}

function DiffPreview({
  original,
  replacement,
}: {
  original: string;
  replacement: string;
}) {
  return (
    <div className="rounded border bg-background text-sm divide-y font-normal">
      <div className="px-3 py-2 bg-red-50/50">
        <span className="text-xs uppercase tracking-wide text-red-800 mr-2">
          Was
        </span>
        <span className="line-through text-red-900/80">{original}</span>
      </div>
      <div className="px-3 py-2 bg-emerald-50/50">
        <span className="text-xs uppercase tracking-wide text-emerald-800 mr-2">
          Becomes
        </span>
        <span className="text-emerald-900">{replacement}</span>
      </div>
    </div>
  );
}
