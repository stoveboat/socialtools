"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  FORMAT_LABEL,
  REGISTERS_BY_FORMAT,
  type DerivationFormat,
} from "@/lib/diagnostics/types";

interface FormatPanelProps {
  pieceId: string;
  format: DerivationFormat;
  description: string;
  existing?: { register: string };
}

export function FormatPanel({
  pieceId,
  format,
  description,
  existing,
}: FormatPanelProps) {
  const router = useRouter();
  const registers = REGISTERS_BY_FORMAT[format];
  const [register, setRegister] = useState<string>(
    existing?.register ?? registers[0],
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/derivation/${pieceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, register }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `HTTP ${res.status}`);
      }
      router.push(`/convert/${pieceId}/${format}`);
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  };

  return (
    <section className="rounded-lg border p-5 space-y-4">
      <div>
        <h2 className="font-semibold">{FORMAT_LABEL[format]}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {existing ? (
        <p className="text-xs rounded-md bg-emerald-50 text-emerald-900 px-3 py-2">
          A brief was already generated with the <strong>{existing.register}</strong>{" "}
          register. Generating again will discard the previous brief.
        </p>
      ) : null}

      <div>
        <p className="text-sm mb-2">Pick a register:</p>
        <RadioGroup value={register} onValueChange={setRegister}>
          {registers.map((opt, i) => (
            <div key={i} className="flex items-start gap-2">
              <RadioGroupItem
                value={opt}
                id={`${format}-${i}`}
                className="mt-1"
              />
              <Label
                htmlFor={`${format}-${i}`}
                className="font-normal leading-snug"
              >
                {opt}
              </Label>
            </div>
          ))}
        </RadioGroup>
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
            ? "Generating..."
            : existing
              ? "Regenerate"
              : "Configure"}
        </Button>
        {existing ? (
          <Button
            variant="outline"
            onClick={() => router.push(`/convert/${pieceId}/${format}`)}
            disabled={pending}
          >
            View brief
          </Button>
        ) : null}
      </div>
    </section>
  );
}
