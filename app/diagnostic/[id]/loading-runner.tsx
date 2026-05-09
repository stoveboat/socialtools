"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_MESSAGES = [
  "Reading your script...",
  "Inferring channel context...",
  "Grading spine clarity...",
  "Grading audience specificity...",
  "Grading tension presence...",
  "Grading payoff specificity...",
  "Grading authority and authenticity...",
  "Grading hook strength...",
  "Grading structural integrity...",
  "Grading specificity throughout...",
  "Grading compression...",
  "Grading voice consistency...",
  "Grading off-positioning risk...",
  "Aggregating the report...",
];

export function LoadingRunner({ pieceId }: { pieceId: string }) {
  const router = useRouter();
  const [statusIdx, setStatusIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const interval = setInterval(() => {
      setStatusIdx((i) => Math.min(i + 1, STATUS_MESSAGES.length - 1));
    }, 2200);

    (async () => {
      try {
        const res = await fetch(`/api/diagnostic/${pieceId}/start`, {
          method: "POST",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || body.error || `HTTP ${res.status}`);
        }
        clearInterval(interval);
        router.replace(`/diagnostic/${pieceId}/summary`);
      } catch (err) {
        clearInterval(interval);
        setError((err as Error).message);
      }
    })();

    return () => clearInterval(interval);
  }, [pieceId, router]);

  if (error) {
    return (
      <div className="space-y-3">
        <p
          role="alert"
          className="text-sm rounded-md bg-red-50 text-red-900 px-3 py-2"
        >
          {error}
        </p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            startedRef.current = false;
            setStatusIdx(0);
            // simplest retry: reload the page so the effect re-fires.
            router.refresh();
          }}
          className="text-sm underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="h-10 w-10 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
      <p className="text-sm text-muted-foreground">
        {STATUS_MESSAGES[statusIdx]}
      </p>
      <p className="text-xs text-muted-foreground">
        ~30 seconds. The eleven grades run in parallel.
      </p>
    </div>
  );
}
