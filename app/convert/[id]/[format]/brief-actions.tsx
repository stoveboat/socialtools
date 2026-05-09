"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  REGISTERS_BY_FORMAT,
  type DerivationFormat,
} from "@/lib/diagnostics/types";

interface BriefActionsProps {
  pieceId: string;
  briefId: string;
  format: DerivationFormat;
  currentRegister: string;
  textForCopy: string;
  filename: string;
}

export function BriefActions({
  pieceId,
  briefId,
  format,
  currentRegister,
  textForCopy,
  filename,
}: BriefActionsProps) {
  const router = useRouter();
  const [showRegen, setShowRegen] = useState(false);
  const [register, setRegister] = useState(currentRegister);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [marked, setMarked] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(textForCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Clipboard write failed");
    }
  };

  const exportMd = () => {
    const blob = new Blob([textForCopy], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const regenerate = async () => {
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
      router.refresh();
      setShowRegen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  const markFinal = async () => {
    setError(null);
    try {
      const res = await fetch(`/api/derivation/${pieceId}/${briefId}/finalize`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `HTTP ${res.status}`);
      }
      setMarked(true);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={copy} variant="outline">
          {copied ? "Copied" : "Copy to clipboard"}
        </Button>
        <Button onClick={exportMd} variant="outline">
          Export as text
        </Button>
        <Button
          onClick={() => setShowRegen((s) => !s)}
          variant="outline"
          disabled={pending}
        >
          Regenerate with different angle
        </Button>
        <Button onClick={markFinal} disabled={marked}>
          {marked ? "Marked final" : "Mark as final"}
        </Button>
      </div>

      {showRegen ? (
        <div className="rounded-lg border p-4 space-y-3">
          <p className="text-sm font-medium">Pick a different angle:</p>
          <RadioGroup
            value={register}
            onValueChange={setRegister}
            className="space-y-2"
          >
            {REGISTERS_BY_FORMAT[format].map((opt) => (
              <Label
                key={opt.name}
                htmlFor={`regen-${opt.name}`}
                className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition ${
                  register === opt.name
                    ? "border-foreground bg-muted/40"
                    : "hover:bg-muted/20"
                }`}
              >
                <RadioGroupItem
                  value={opt.name}
                  id={`regen-${opt.name}`}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <div className="font-medium leading-tight">{opt.name}</div>
                  <div className="text-sm text-muted-foreground leading-snug font-normal">
                    {opt.oneliner}
                  </div>
                </div>
              </Label>
            ))}
          </RadioGroup>
          <div className="flex gap-2">
            <Button onClick={regenerate} disabled={pending}>
              {pending ? "Generating..." : "Regenerate"}
            </Button>
            <Button
              onClick={() => setShowRegen(false)}
              variant="outline"
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="text-sm rounded-md bg-red-50 text-red-900 px-3 py-2"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
