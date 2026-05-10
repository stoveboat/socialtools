"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FORMAT_LABEL } from "@/lib/diagnostics/types";

interface CaptionReelPanelProps {
  pieceId: string;
  existing?: { hasOne: boolean };
}

export function CaptionReelPanel({ pieceId, existing }: CaptionReelPanelProps) {
  const router = useRouter();
  const [nonNegotiables, setNonNegotiables] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/derivation/${pieceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: "caption_reel",
          non_negotiables: nonNegotiables.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `HTTP ${res.status}`);
      }
      router.push(`/convert/${pieceId}/caption_reel`);
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  };

  return (
    <section className="rounded-lg border p-5 space-y-4">
      <div className="space-y-1">
        <h2 className="font-semibold">{FORMAT_LABEL.caption_reel}</h2>
        <p className="text-sm text-muted-foreground">
          A 7-second looping vertical video where the entire visual surface
          is a wall of text. The text takes 10-15 seconds to read; the loop
          forces rereading. Success depends on shareability, commentability,
          and rereadability — the format works on different rules from the
          carousel or voiceover.
        </p>
      </div>

      {existing?.hasOne ? (
        <p className="text-xs rounded-md bg-emerald-50 text-emerald-900 px-3 py-2">
          A wall has already been generated for this piece. Generating again
          will replace it.
        </p>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium">
          Non-negotiables{" "}
          <span className="font-normal text-muted-foreground">
            (optional)
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          Phrases the wall must include, lines it must end on, or directives
          like &ldquo;must end on the permission line&rdquo;. Leave blank to
          let the model choose.
        </p>
        <Textarea
          rows={3}
          value={nonNegotiables}
          onChange={(e) => setNonNegotiables(e.target.value)}
          placeholder={`e.g. "must end on: 'you don't need a planner. you need permission to keep yours simple.'"`}
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="text-sm rounded-md bg-red-50 text-red-900 px-3 py-2"
        >
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button onClick={generate} disabled={pending}>
          {pending
            ? "Building the wall..."
            : existing?.hasOne
              ? "Regenerate wall"
              : "Generate wall"}
        </Button>
        {existing?.hasOne ? (
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/convert/${pieceId}/caption_reel`)
            }
            disabled={pending}
          >
            View wall
          </Button>
        ) : null}
      </div>
    </section>
  );
}
