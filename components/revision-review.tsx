"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ParagraphDiff } from "@/components/paragraph-diff";

export interface RevisionPreview {
  revised_script: string;
  what_changed: string;
  carries_forward?: string[];
  source_script: string;
}

interface RevisionReviewProps {
  diagnosticId: string;
  passId: string;
  pieceId: string;
  revision: RevisionPreview;
  feedback: string;
  setFeedback: (v: string) => void;
  onIterate: () => void;
  onDiscard: () => void;
  generating: boolean;
  // Foundation pass uses this to lock the user's payoff-type choice so
  // subsequent re-grades can apply payoff-aware rubrics.
  lockedPayoffType?: string;
}

export function RevisionReview({
  diagnosticId,
  passId,
  pieceId,
  revision,
  feedback,
  setFeedback,
  onIterate,
  onDiscard,
  generating,
  lockedPayoffType,
}: RevisionReviewProps) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/repair/${diagnosticId}/pass/${passId}/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revised_script: revision.revised_script,
            locked_payoff_type: lockedPayoffType,
          }),
        },
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          errBody.detail || errBody.error || `HTTP ${res.status}`,
        );
      }
      router.replace(`/diagnostic/${pieceId}/summary`);
    } catch (err) {
      setError((err as Error).message);
      setAccepting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          What the pass did
        </p>
        <p className="text-sm leading-relaxed">{revision.what_changed}</p>
        {revision.carries_forward && revision.carries_forward.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Phrases carried forward from the source:{" "}
            {revision.carries_forward.map((s) => `"${s}"`).join(", ")}
          </p>
        ) : null}
      </div>

      <ParagraphDiff
        original={revision.source_script}
        revised={revision.revised_script}
      />

      {error ? (
        <p
          role="alert"
          className="text-sm rounded-md bg-red-50 text-red-900 px-3 py-2"
        >
          {error}
        </p>
      ) : null}

      <div className="rounded-lg border p-4 space-y-3">
        <div className="space-y-2">
          <Label htmlFor="iterate-feedback" className="text-sm font-medium">
            Not quite right? Tell the model what to change.
          </Label>
          <Textarea
            id="iterate-feedback"
            rows={3}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Keep the espresso-machine analogy. Make the close land on permission, not a tactic. Shorter."
          />
          <p className="text-xs text-muted-foreground">
            Iterating sends the model another attempt with your notes plus the
            same directional choices. The script doesn{"'"}t change in the
            database until you accept.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={accept} disabled={accepting}>
            {accepting
              ? "Re-grading the refined draft..."
              : "Accept and re-grade"}
          </Button>
          <Button
            variant="outline"
            onClick={onIterate}
            disabled={generating || accepting}
          >
            {generating ? "Generating..." : "Iterate with notes"}
          </Button>
          <Button
            variant="outline"
            onClick={onDiscard}
            disabled={generating || accepting}
          >
            Discard and start over
          </Button>
        </div>
      </div>
    </div>
  );
}
