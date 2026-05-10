"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  RevisionReview,
  type RevisionPreview,
} from "@/components/revision-review";
import {
  ENGAGEMENT_ENGINES,
  STRUCTURAL_SHAPES,
} from "@/lib/diagnostics/passes";

interface EngagementFlowProps {
  diagnosticId: string;
  pieceId: string;
  defaultAudience: string;
}

export function EngagementFlow({
  diagnosticId,
  pieceId,
  defaultAudience,
}: EngagementFlowProps) {
  const [engagementId, setEngagementId] = useState<string>("");
  const [shapeId, setShapeId] = useState<string>("");
  const [audience, setAudience] = useState(defaultAudience);
  const [feedback, setFeedback] = useState("");
  const [generating, setGenerating] = useState(false);
  const [revision, setRevision] = useState<RevisionPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = !!engagementId && !!shapeId && !!audience.trim();

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const engine = ENGAGEMENT_ENGINES.find((e) => e.id === engagementId);
      const shape = STRUCTURAL_SHAPES.find((s) => s.id === shapeId);
      const res = await fetch(
        `/api/repair/${diagnosticId}/pass/engagement_structure/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            engagement_engine: engine?.label ?? engagementId,
            structural_shape: shape?.label ?? shapeId,
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
        passId="engagement_structure"
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
        <h2 className="text-sm font-semibold">
          Step 1 — Pick the engagement engine
        </h2>
        <p className="text-xs text-muted-foreground">
          What pulls the viewer forward through the script.
        </p>
        <RadioGroup
          value={engagementId}
          onValueChange={setEngagementId}
          className="space-y-2"
        >
          {ENGAGEMENT_ENGINES.map((e) => (
            <Label
              key={e.id}
              htmlFor={`engine-${e.id}`}
              className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${
                engagementId === e.id
                  ? "border-foreground bg-muted/40"
                  : "hover:bg-muted/20"
              }`}
            >
              <RadioGroupItem
                value={e.id}
                id={`engine-${e.id}`}
                className="mt-1"
              />
              <div className="space-y-0.5">
                <div className="font-medium leading-snug">{e.label}</div>
                <div className="text-sm text-muted-foreground leading-snug font-normal">
                  {e.blurb}
                </div>
              </div>
            </Label>
          ))}
        </RadioGroup>
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="text-sm font-semibold">
          Step 2 — Pick the structural shape
        </h2>
        <p className="text-xs text-muted-foreground">
          The skeleton the script will follow end-to-end.
        </p>
        <RadioGroup
          value={shapeId}
          onValueChange={setShapeId}
          className="space-y-2"
        >
          {STRUCTURAL_SHAPES.map((s) => (
            <Label
              key={s.id}
              htmlFor={`shape-${s.id}`}
              className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${
                shapeId === s.id
                  ? "border-foreground bg-muted/40"
                  : "hover:bg-muted/20"
              }`}
            >
              <RadioGroupItem
                value={s.id}
                id={`shape-${s.id}`}
                className="mt-1"
              />
              <div className="space-y-0.5">
                <div className="font-medium leading-snug">{s.label}</div>
                <div className="text-sm text-muted-foreground leading-snug font-normal">
                  {s.blurb}
                </div>
              </div>
            </Label>
          ))}
        </RadioGroup>
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="text-sm font-semibold">
          Step 3 — Confirm the audience
        </h2>
        <Input
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
        />
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="text-sm font-semibold">
          Step 4 — Directional notes (optional)
        </h2>
        <Textarea
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Anything the model should know before generating."
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
        <Button onClick={generate} disabled={!canGenerate || generating}>
          {generating ? "Generating revision..." : "Generate revision"}
        </Button>
      </div>
    </div>
  );
}
