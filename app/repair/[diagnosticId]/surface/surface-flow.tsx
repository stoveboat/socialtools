"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  RevisionReview,
  type RevisionPreview,
} from "@/components/revision-review";

interface SurfaceFlowProps {
  diagnosticId: string;
  pieceId: string;
  defaultAudience: string;
}

export function SurfaceFlow({
  diagnosticId,
  pieceId,
  defaultAudience,
}: SurfaceFlowProps) {
  const [audience, setAudience] = useState(defaultAudience);
  const [feedback, setFeedback] = useState("");
  const [generating, setGenerating] = useState(false);
  const [revision, setRevision] = useState<RevisionPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/repair/${diagnosticId}/pass/surface/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audience: audience.trim(),
            feedback,
          }),
        },
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          errBody.detail || errBody.error || `HTTP ${res.status}`,
        );
      }
      const data = await res.json();
      setRevision({
        revised_script: data.revised_script,
        what_changed: data.what_changed,
        carries_forward: data.carries_forward,
        source_script: data.source_script,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  if (revision) {
    return (
      <RevisionReview
        diagnosticId={diagnosticId}
        passId="surface"
        pieceId={pieceId}
        revision={revision}
        feedback={feedback}
        setFeedback={setFeedback}
        onIterate={generate}
        onDiscard={() => {
          setRevision(null);
          setError(null);
        }}
        generating={generating}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border p-4 space-y-3">
        <p className="text-sm leading-relaxed">
          The Surface pass tightens texture: replaces vague language with
          specifics where the source has them latent, cuts padding phrases,
          and smooths voice consistency. It does not change spine, payoff, or
          structural shape — those are set by earlier passes (or by the
          source if you skipped them).
        </p>
        <p className="text-sm leading-relaxed">
          Most short-form scripts shrink 10-25% in this pass. Click Generate
          to see the proposed tighter version.
        </p>
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="text-sm font-semibold">Confirm the audience</h2>
        <Input
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
        />
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="text-sm font-semibold">
          Directional notes (optional)
        </h2>
        <Label className="text-xs text-muted-foreground font-normal">
          Specifics to keep, things to cut, voice cues to preserve.
        </Label>
        <Textarea
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Keep the espresso-machine analogy. Cut the morning routine paragraph entirely. Don't shorten the close."
        />
      </section>

      {error ? (
        <p
          role="alert"
          className="text-sm rounded-md bg-red-50 text-red-900 px-3 py-2"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={generate} disabled={generating || !audience.trim()}>
          {generating ? "Generating revision..." : "Generate tighter version"}
        </Button>
      </div>
    </div>
  );
}
