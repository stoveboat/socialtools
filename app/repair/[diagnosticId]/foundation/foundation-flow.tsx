"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  RevisionReview,
  type RevisionPreview,
} from "@/components/revision-review";
import { PAYOFF_TYPES } from "@/lib/diagnostics/passes";
import type {
  SalvageableSeed,
  SpineCandidate,
} from "@/lib/diagnostics/revise";

type Mode = "revise" | "rebuild" | "scratch";

interface FoundationFlowProps {
  diagnosticId: string;
  pieceId: string;
  defaultAudience: string;
}

const SEED_TYPE_LABEL: Record<SalvageableSeed["type"], string> = {
  concrete_image: "Concrete image",
  contrarian_claim: "Contrarian claim",
  personal_experience: "Personal experience",
  specific_fact: "Specific fact",
};

export function FoundationFlow({
  diagnosticId,
  pieceId,
  defaultAudience,
}: FoundationFlowProps) {
  // Options loading
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [spineCandidates, setSpineCandidates] = useState<SpineCandidate[]>([]);
  const [seeds, setSeeds] = useState<SalvageableSeed[]>([]);

  // User selections
  const [mode, setMode] = useState<Mode>("revise");
  const [spineIdx, setSpineIdx] = useState<string>("");
  const [seedIdx, setSeedIdx] = useState<string>("");
  const [customSpine, setCustomSpine] = useState("");
  const [audience, setAudience] = useState(defaultAudience);
  const [payoffType, setPayoffType] = useState<string>("");
  const [feedback, setFeedback] = useState("");

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [revision, setRevision] = useState<RevisionPreview | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/repair/${diagnosticId}/pass/foundation/options`,
          { method: "POST" },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || body.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (cancelled) return;
        setSpineCandidates(data.spine_candidates ?? []);
        setSeeds(data.salvageable_seeds ?? []);
      } catch (err) {
        if (!cancelled) setOptionsError((err as Error).message);
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [diagnosticId]);

  const resolvedSpine = (() => {
    if (mode === "scratch") return customSpine.trim();
    if (mode === "revise") {
      if (spineIdx === "__custom__") return customSpine.trim();
      const i = Number(spineIdx);
      return spineCandidates[i]?.spine ?? "";
    }
    if (mode === "rebuild") {
      if (spineIdx === "__custom__") return customSpine.trim();
      const i = Number(spineIdx);
      return spineCandidates[i]?.spine ?? "";
    }
    return "";
  })();

  const seed = seedIdx !== "" ? seeds[Number(seedIdx)] : undefined;

  const canGenerate = (() => {
    if (!audience.trim()) return false;
    if (!payoffType) return false;
    if (!resolvedSpine) return false;
    if (mode === "rebuild" && !seed) return false;
    return true;
  })();

  const generate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const payoff = PAYOFF_TYPES.find((p) => p.id === payoffType);
      const body: Record<string, unknown> = {
        mode,
        spine: resolvedSpine,
        audience: audience.trim(),
        payoff_type: payoff?.label ?? payoffType,
        feedback,
      };
      if (mode === "rebuild" && seed) {
        body.seed_fragment = seed.fragment;
        body.seed_type = seed.type;
      }
      const res = await fetch(
        `/api/repair/${diagnosticId}/pass/foundation/generate`,
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
      const data = await res.json();
      setRevision({
        revised_script: data.revised_script,
        what_changed: data.what_changed,
        carries_forward: data.carries_forward,
        source_script: data.source_script,
      });
    } catch (err) {
      setGenError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  if (optionsLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="h-8 w-8 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
        <p className="text-sm text-muted-foreground">
          Reading the script and proposing spines and seeds...
        </p>
      </div>
    );
  }

  if (optionsError) {
    return (
      <p
        role="alert"
        className="text-sm rounded-md bg-red-50 text-red-900 px-3 py-2"
      >
        {optionsError}
      </p>
    );
  }

  // Revision review surface — replaces the form once generation succeeds.
  if (revision) {
    return (
      <RevisionReview
        diagnosticId={diagnosticId}
        passId="foundation"
        pieceId={pieceId}
        revision={revision}
        feedback={feedback}
        setFeedback={setFeedback}
        onIterate={generate}
        onDiscard={() => {
          setRevision(null);
          setGenError(null);
        }}
        generating={generating}
      />
    );
  }

  // Pre-generation form.
  return (
    <div className="space-y-6">
      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="text-sm font-semibold">
          Step 1 — How do you want to approach the foundation?
        </h2>
        <RadioGroup
          value={mode}
          onValueChange={(v) => {
            setMode(v as Mode);
            setSpineIdx("");
            setSeedIdx("");
            setCustomSpine("");
          }}
          className="space-y-2"
        >
          {(
            [
              {
                id: "revise",
                label: "Revise the current draft around its strongest spine",
                blurb:
                  "Best when the script has good seeds but a muddled foundation.",
              },
              {
                id: "rebuild",
                label: "Rebuild from one specific element of the draft",
                blurb:
                  "Best when only one passage is worth keeping. The rest is a fresh draft built around it.",
              },
              {
                id: "scratch",
                label: "Start over with a clean spine I'll write myself",
                blurb:
                  "Best when the foundation is so weak nothing in the draft is worth revising around. Voice still inherits from the source.",
              },
            ] as const
          ).map((m) => (
            <Label
              key={m.id}
              htmlFor={`mode-${m.id}`}
              className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition ${
                mode === m.id
                  ? "border-foreground bg-muted/40"
                  : "hover:bg-muted/20"
              }`}
            >
              <RadioGroupItem
                value={m.id}
                id={`mode-${m.id}`}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <div className="font-medium leading-tight">{m.label}</div>
                <div className="text-sm text-muted-foreground leading-snug font-normal">
                  {m.blurb}
                </div>
              </div>
            </Label>
          ))}
        </RadioGroup>
      </section>

      {mode === "revise" || mode === "rebuild" ? (
        <section className="rounded-lg border p-4 space-y-3">
          <h2 className="text-sm font-semibold">
            Step 2 — Pick the spine for the revision
          </h2>
          {spineCandidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              The model couldn{"'"}t draw clean spine candidates from this
              script. Use the {'"'}write your own{'"'} option below.
            </p>
          ) : null}
          <RadioGroup
            value={spineIdx}
            onValueChange={setSpineIdx}
            className="space-y-2"
          >
            {spineCandidates.map((c, i) => (
              <Label
                key={i}
                htmlFor={`spine-${i}`}
                className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${
                  String(i) === spineIdx
                    ? "border-foreground bg-muted/40"
                    : "hover:bg-muted/20"
                }`}
              >
                <RadioGroupItem
                  value={String(i)}
                  id={`spine-${i}`}
                  className="mt-1"
                />
                <div className="space-y-1">
                  <div className="font-medium leading-snug">{c.spine}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.type === "drawn_from_script"
                      ? "Drawn from the script"
                      : "Sharpened articulation"}
                    {" · "}
                    {c.rationale}
                  </div>
                </div>
              </Label>
            ))}
            <Label
              htmlFor="spine-custom"
              className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${
                spineIdx === "__custom__"
                  ? "border-foreground bg-muted/40"
                  : "hover:bg-muted/20"
              }`}
            >
              <RadioGroupItem
                value="__custom__"
                id="spine-custom"
                className="mt-1"
              />
              <div className="space-y-2 flex-1">
                <div className="font-medium leading-snug">
                  Write my own spine
                </div>
                {spineIdx === "__custom__" ? (
                  <Input
                    value={customSpine}
                    onChange={(e) => setCustomSpine(e.target.value)}
                    placeholder="One sentence, 12-25 words. The thesis the script exists to deliver."
                  />
                ) : null}
              </div>
            </Label>
          </RadioGroup>
        </section>
      ) : null}

      {mode === "scratch" ? (
        <section className="rounded-lg border p-4 space-y-3">
          <h2 className="text-sm font-semibold">
            Step 2 — Write the spine for the new draft
          </h2>
          <Textarea
            rows={2}
            value={customSpine}
            onChange={(e) => setCustomSpine(e.target.value)}
            placeholder="One sentence, 12-25 words. The thesis the new draft exists to deliver."
          />
        </section>
      ) : null}

      {mode === "rebuild" ? (
        <section className="rounded-lg border p-4 space-y-3">
          <h2 className="text-sm font-semibold">
            Step 3 — Pick the seed to build around
          </h2>
          {seeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              The model couldn{"'"}t find salvageable seeds in this script.
              Switch to{" "}
              <button
                type="button"
                onClick={() => setMode("scratch")}
                className="underline"
              >
                start over
              </button>{" "}
              instead.
            </p>
          ) : (
            <RadioGroup
              value={seedIdx}
              onValueChange={setSeedIdx}
              className="space-y-2"
            >
              {seeds.map((s, i) => (
                <Label
                  key={i}
                  htmlFor={`seed-${i}`}
                  className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${
                    String(i) === seedIdx
                      ? "border-foreground bg-muted/40"
                      : "hover:bg-muted/20"
                  }`}
                >
                  <RadioGroupItem
                    value={String(i)}
                    id={`seed-${i}`}
                    className="mt-1"
                  />
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      {SEED_TYPE_LABEL[s.type]}
                    </div>
                    <div className="font-medium leading-snug italic">
                      {'"'}{s.fragment}{'"'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.rationale}
                    </div>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          )}
        </section>
      ) : null}

      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="text-sm font-semibold">
          {mode === "rebuild" ? "Step 4" : "Step 3"} — Confirm the audience
        </h2>
        <Input
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="Specific subset of viewers"
        />
        <p className="text-xs text-muted-foreground">
          Defaults to the audience you confirmed in Phase 0. Override if this
          pass should target someone different.
        </p>
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="text-sm font-semibold">
          {mode === "rebuild" ? "Step 5" : "Step 4"} — Pick the payoff type
        </h2>
        <p className="text-xs text-muted-foreground">
          The closing 1-3 sentences will land in this shape.
        </p>
        <RadioGroup
          value={payoffType}
          onValueChange={setPayoffType}
          className="space-y-2"
        >
          {PAYOFF_TYPES.map((p) => (
            <Label
              key={p.id}
              htmlFor={`payoff-${p.id}`}
              className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${
                payoffType === p.id
                  ? "border-foreground bg-muted/40"
                  : "hover:bg-muted/20"
              }`}
            >
              <RadioGroupItem
                value={p.id}
                id={`payoff-${p.id}`}
                className="mt-1"
              />
              <div className="space-y-0.5">
                <div className="font-medium leading-snug">{p.label}</div>
                <div className="text-sm text-muted-foreground leading-snug font-normal">
                  {p.blurb}
                </div>
              </div>
            </Label>
          ))}
        </RadioGroup>
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="text-sm font-semibold">
          {mode === "rebuild" ? "Step 6" : "Step 5"} — Directional notes
          (optional)
        </h2>
        <Textarea
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Anything the model should know before generating. e.g. 'keep the metaphor', 'shorter close', 'less prescriptive tone'."
        />
      </section>

      {genError ? (
        <p
          role="alert"
          className="text-sm rounded-md bg-red-50 text-red-900 px-3 py-2"
        >
          {genError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={generate} disabled={!canGenerate || generating}>
          {generating
            ? "Generating revision..."
            : "Generate revision"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Takes ~15-30 seconds. The script doesn{"'"}t change until you accept
          the result.
        </p>
      </div>
    </div>
  );
}
