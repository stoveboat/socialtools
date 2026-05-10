"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { analyzeScript } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Reading your script..." : "Analyze script"}
    </Button>
  );
}

export function AnalyzeForm({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action={analyzeScript} className="space-y-4">
      <Textarea
        name="script"
        rows={8}
        required
        placeholder="Paste your script here..."
        defaultValue={defaultValue}
        className="min-h-48"
      />
      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
