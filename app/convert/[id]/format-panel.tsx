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
  question: string;
  existing?: { register: string };
}

export function FormatPanel({
  pieceId,
  format,
  question,
  existing,
}: FormatPanelProps) {
  const router = useRouter();
  const options = REGISTERS_BY_FORMAT[format];
  const [register, setRegister] = useState<string>(
    existing?.register ?? options[0].name,
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

  const existingOption = existing
    ? options.find((o) => o.name === existing.register)
    : undefined;

  return (
    <section className="rounded-lg border p-5 space-y-5">
      <div className="space-y-1">
        <h2 className="font-semibold">{FORMAT_LABEL[format]}</h2>
        <p className="text-sm text-muted-foreground">{question}</p>
      </div>

      {existing ? (
        <p className="text-xs rounded-md bg-emerald-50 text-emerald-900 px-3 py-2">
          Already generated as <strong>{existing.register}</strong>
          {existingOption ? ` — ${existingOption.oneliner.toLowerCase()}` : ""}{" "}
          Generating again will replace it.
        </p>
      ) : null}

      <RadioGroup
        value={register}
        onValueChange={setRegister}
        className="space-y-3"
      >
        {options.map((opt) => (
          <Label
            key={opt.name}
            htmlFor={`${format}-${opt.name}`}
            className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition ${
              register === opt.name
                ? "border-foreground bg-muted/40"
                : "hover:bg-muted/20"
            }`}
          >
            <RadioGroupItem
              value={opt.name}
              id={`${format}-${opt.name}`}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <div className="font-medium leading-tight">{opt.name}</div>
              <div className="text-sm text-muted-foreground leading-snug font-normal">
                {opt.oneliner}
              </div>
              <div className="text-xs italic text-muted-foreground/80 leading-snug font-normal">
                {opt.example}
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

      <div className="flex items-center gap-3">
        <Button onClick={generate} disabled={pending}>
          {pending
            ? "Generating..."
            : existing
              ? "Regenerate"
              : "Generate brief"}
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
