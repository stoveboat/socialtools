"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface PendingEdit {
  choice_id: string;
  dimension_id: string;
  dimension_name: string;
  description: string;
  original: string;
  replacement: string;
  user_edited_replacement: string | null;
  status: string;
}

interface RewriteFlowProps {
  diagnosticId: string;
  pieceId: string;
  source_script: string;
  edits: PendingEdit[];
}

type LocalStatus = "pending" | "accepted" | "edited" | "rejected";

interface LocalEditState extends PendingEdit {
  localStatus: LocalStatus;
  localReplacement: string;
}

export function RewriteFlow({
  diagnosticId,
  pieceId,
  source_script,
  edits,
}: RewriteFlowProps) {
  const router = useRouter();
  const [items, setItems] = useState<LocalEditState[]>(() =>
    edits.map((e) => ({
      ...e,
      localStatus:
        e.status === "accepted" || e.status === "edited" || e.status === "rejected"
          ? (e.status as LocalStatus)
          : "accepted",
      localReplacement: e.user_edited_replacement ?? e.replacement,
    })),
  );
  const [idx, setIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = items[idx];
  const total = items.length;

  if (total === 0) {
    return (
      <p className="text-sm rounded-md bg-muted/40 px-3 py-2">
        No accepted edits to review. Go back and pick at least one fix.
      </p>
    );
  }

  const updateRemote = async (
    choiceId: string,
    update: { status: LocalStatus; user_edited_replacement?: string },
  ) => {
    const res = await fetch(
      `/api/repair/${diagnosticId}/edit/${choiceId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || body.error || `HTTP ${res.status}`);
    }
  };

  const advance = () => {
    setEditing(false);
    setError(null);
    if (idx < total - 1) {
      setIdx(idx + 1);
    }
  };

  const accept = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await updateRemote(current.choice_id, { status: "accepted" });
      setItems((arr) =>
        arr.map((it, i) =>
          i === idx
            ? { ...it, localStatus: "accepted", localReplacement: it.replacement }
            : it,
        ),
      );
      advance();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const reject = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await updateRemote(current.choice_id, { status: "rejected" });
      setItems((arr) =>
        arr.map((it, i) =>
          i === idx ? { ...it, localStatus: "rejected" } : it,
        ),
      );
      advance();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = () => {
    setDraftText(current.localReplacement);
    setEditing(true);
  };

  const saveEdit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await updateRemote(current.choice_id, {
        status: "edited",
        user_edited_replacement: draftText,
      });
      setItems((arr) =>
        arr.map((it, i) =>
          i === idx
            ? {
                ...it,
                localStatus: "edited",
                localReplacement: draftText,
              }
            : it,
        ),
      );
      advance();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const finalize = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/repair/${diagnosticId}/finalize`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `HTTP ${res.status}`);
      }
      router.push(`/repair/${diagnosticId}/review`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  const allDecided = items.every((it) => it.localStatus !== "pending");
  const hasAccepted = items.some(
    (it) => it.localStatus === "accepted" || it.localStatus === "edited",
  );

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="space-y-3">
        <header className="text-xs uppercase tracking-wide text-muted-foreground">
          Script with the current edit highlighted
        </header>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-muted/40 rounded-md p-4 max-h-[70vh] overflow-y-auto">
          {renderHighlighted(source_script, current)}
        </pre>
      </section>

      <section className="space-y-5">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Edit {idx + 1} of {total} — {current.dimension_name}
          </p>
          <p className="font-medium">{current.description}</p>
        </div>

        <div className="rounded-md border divide-y bg-background text-sm">
          <div className="px-3 py-2 bg-red-50/50">
            <div className="text-xs uppercase tracking-wide text-red-800 mb-1">
              Was
            </div>
            <span className="line-through text-red-900/80">
              {current.original}
            </span>
          </div>
          <div className="px-3 py-2 bg-emerald-50/50">
            <div className="text-xs uppercase tracking-wide text-emerald-800 mb-1">
              Becomes
            </div>
            {editing ? (
              <Textarea
                rows={4}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                className="bg-background"
              />
            ) : (
              <span className="text-emerald-900">
                {current.localReplacement}
              </span>
            )}
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="text-sm rounded-md bg-red-50 text-red-900 px-3 py-2"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {editing ? (
            <>
              <Button onClick={saveEdit} disabled={submitting}>
                {submitting ? "Saving..." : "Save edit and continue"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditing(false)}
                disabled={submitting}
              >
                Cancel edit
              </Button>
            </>
          ) : (
            <>
              <Button onClick={accept} disabled={submitting}>
                Accept
              </Button>
              <Button variant="outline" onClick={startEdit} disabled={submitting}>
                Edit before accepting
              </Button>
              <Button
                variant="outline"
                onClick={reject}
                disabled={submitting}
              >
                Reject
              </Button>
            </>
          )}
        </div>

        <Trace items={items} currentIdx={idx} />

        {allDecided ? (
          <div className="rounded-md border bg-muted/40 p-4 space-y-2">
            <p className="text-sm">
              All {total} edits reviewed.{" "}
              {hasAccepted
                ? "Apply the accepted edits to produce the refined script."
                : "Every edit was rejected — there's nothing to apply."}
            </p>
            <div className="flex gap-2">
              <Button onClick={finalize} disabled={submitting || !hasAccepted}>
                {submitting ? "Applying..." : "Apply edits and continue"}
              </Button>
              <a
                href={`/diagnostic/${pieceId}/summary`}
                className="inline-flex"
              >
                <Button variant="outline">Back to summary</Button>
              </a>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function renderHighlighted(source: string, edit: LocalEditState) {
  const idx = source.indexOf(edit.original);
  if (idx === -1) return source;
  const before = source.slice(0, idx);
  const after = source.slice(idx + edit.original.length);
  return (
    <>
      {before}
      <span className="line-through bg-red-100 text-red-900/80">
        {edit.original}
      </span>{" "}
      <span className="bg-emerald-100 text-emerald-900">
        {edit.localReplacement}
      </span>
      {after}
    </>
  );
}

function Trace({
  items,
  currentIdx,
}: {
  items: LocalEditState[];
  currentIdx: number;
}) {
  return (
    <div className="border-t pt-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
        Trace
      </p>
      <ul className="text-sm space-y-1">
        {items.map((it, i) => (
          <li
            key={it.choice_id}
            className={i === currentIdx ? "font-medium" : "text-muted-foreground"}
          >
            <span className="inline-block w-6 text-xs">{i + 1}.</span>
            <span>{it.dimension_name}</span>{" "}
            <span className="text-xs">
              {it.localStatus === "accepted"
                ? "✓ accepted"
                : it.localStatus === "edited"
                  ? "✎ edited"
                  : it.localStatus === "rejected"
                    ? "✕ rejected"
                    : "pending"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
