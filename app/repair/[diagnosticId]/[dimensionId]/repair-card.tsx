"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { GradeBadge } from "@/components/grade-badge";
import type { FixCandidate } from "@/lib/diagnostics/repair";
import type { DimensionGrade, Grade } from "@/lib/diagnostics/types";

interface RepairCardProps {
  diagnosticId: string;
  pieceId: string;
  dimensionId: string;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "auto_resolved"; freshGrade: DimensionGrade }
  | { kind: "ready"; freshGrade: DimensionGrade; candidates: FixCandidate[] }
  | { kind: "error"; message: string };

export function RepairCard({
  diagnosticId,
  pieceId,
  dimensionId,
}: RepairCardProps) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [selectedIdx, setSelectedIdx] = useState<string>("");
  const [editedReplacement, setEditedReplacement] = useState<string>("");
  const [edited, setEdited] = useState(false);
  const [submitState, setSubmitState] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "applying" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const startedRef = useRef(false);

  // Load candidates on mount.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
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
        if (data.auto_resolved) {
          setState({ kind: "auto_resolved", freshGrade: data.fresh_grade });
        } else {
          setState({
            kind: "ready",
            freshGrade: data.fresh_grade,
            candidates: data.candidates,
          });
        }
      } catch (err) {
        setState({ kind: "error", message: (err as Error).message });
      }
    })();
  }, [diagnosticId, dimensionId]);

  // When user picks a candidate, prime the edit textarea with the proposed
  // replacement so they can tweak it before applying.
  useEffect(() => {
    if (state.kind !== "ready") return;
    if (selectedIdx === "") return;
    const cand = state.candidates[Number(selectedIdx)];
    if (!cand) return;
    if (!edited) {
      setEditedReplacement(cand.replacement_sentences.join(" "));
    }
  }, [selectedIdx, state, edited]);

  // Auto-resolved state: kick the user forward to the next remaining card or
  // to /review. The entry route handles the routing.
  useEffect(() => {
    if (state.kind === "auto_resolved") {
      const t = setTimeout(() => {
        router.replace(`/repair/${diagnosticId}`);
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [state, router, diagnosticId]);

  const submit = async (action: "apply" | "skip") => {
    setSubmitState({ kind: "submitting" });
    const body =
      action === "skip"
        ? { skipped: true }
        : {
            candidate:
              state.kind === "ready"
                ? state.candidates[Number(selectedIdx)]
                : undefined,
            edited_replacement: edited ? editedReplacement : undefined,
          };
    try {
      setSubmitState({ kind: "applying" });
      const res = await fetch(
        `/api/repair/${diagnosticId}/${dimensionId}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `HTTP ${res.status}`);
      }
      // We always return to the Summary so the user sees the refined script
      // and the updated grades, picks the next move, or stops. The apply
      // route's response shape is currently unused on the client.
      await res.json().catch(() => ({}));
      router.replace(`/diagnostic/${pieceId}/summary`);
    } catch (err) {
      setSubmitState({ kind: "error", message: (err as Error).message });
    }
  };

  if (state.kind === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="h-8 w-8 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
        <p className="text-sm text-muted-foreground">
          Diagnosing the latest version of your script and proposing fixes...
        </p>
      </div>
    );
  }

  if (state.kind === "auto_resolved") {
    return (
      <div className="rounded-md border bg-emerald-50 border-emerald-300 p-5 space-y-2">
        <p className="text-sm font-medium text-emerald-900">
          Already resolved — graded {state.freshGrade.grade} now.
        </p>
        <p className="text-sm text-emerald-900/80">
          A previous fix appears to have addressed this dimension. Skipping
          ahead.
        </p>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <p
        role="alert"
        className="text-sm rounded-md bg-red-50 text-red-900 px-3 py-2"
      >
        {state.message}
      </p>
    );
  }

  // ready
  const fresh = state.freshGrade;
  const selected = selectedIdx !== "" ? state.candidates[Number(selectedIdx)] : undefined;

  return (
    <div className="space-y-5">
      <div className="rounded-md border p-4 space-y-2">
        <div className="flex items-center gap-3">
          <GradeBadge grade={fresh.grade as Grade} />
          <p className="text-sm font-medium">
            Fresh read: {fresh.dimension_name} graded {fresh.grade}
          </p>
        </div>
        <blockquote className="border-l-2 pl-3 text-sm leading-relaxed text-muted-foreground">
          {fresh.evidence}
        </blockquote>
      </div>

      <RadioGroup
        value={selectedIdx}
        onValueChange={(v) => {
          setSelectedIdx(v);
          setEdited(false);
        }}
        className="space-y-3"
      >
        {state.candidates.map((c, i) => (
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

      {selected ? (
        <div className="rounded-md border bg-muted/20 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">
              {edited
                ? "You're editing the replacement"
                : "Replacement (you can edit before applying)"}
            </p>
            {edited ? (
              <button
                type="button"
                onClick={() => {
                  setEdited(false);
                  setEditedReplacement(selected.replacement_sentences.join(" "));
                }}
                className="text-xs underline text-muted-foreground"
              >
                Reset to original suggestion
              </button>
            ) : null}
          </div>
          <Textarea
            rows={4}
            value={editedReplacement}
            onChange={(e) => {
              setEditedReplacement(e.target.value);
              setEdited(true);
            }}
            className="bg-background"
          />
        </div>
      ) : null}

      {submitState.kind === "error" ? (
        <p
          role="alert"
          className="text-sm rounded-md bg-red-50 text-red-900 px-3 py-2"
        >
          {submitState.message}
        </p>
      ) : null}

      {submitState.kind === "applying" ? (
        <div className="rounded-md border bg-muted/40 p-4 flex items-center gap-3">
          <div className="h-4 w-4 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">
            Applying the fix and checking the remaining dimensions...
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => submit("apply")}
          disabled={
            !selected ||
            submitState.kind === "submitting" ||
            submitState.kind === "applying"
          }
        >
          {submitState.kind === "applying" ? "Applying..." : "Apply this fix"}
        </Button>
        <Button
          variant="outline"
          onClick={() => submit("skip")}
          disabled={
            submitState.kind === "submitting" || submitState.kind === "applying"
          }
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
