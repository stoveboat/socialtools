// Paragraph-level diff. Splits both inputs by blank-line boundaries (paragraphs)
// and computes an LCS to mark added / removed / unchanged paragraphs. We
// avoid word-level diffs deliberately — prose revisions usually rewrite whole
// sentences, and word-level highlighting becomes noise. Paragraph granularity
// is enough for the user to see what moved.

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

interface DiffOp {
  kind: "equal" | "remove" | "add";
  text: string;
}

function lcsDiff(a: string[], b: string[]): DiffOp[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      ops.push({ kind: "equal", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ kind: "remove", text: a[i] });
      i++;
    } else {
      ops.push({ kind: "add", text: b[j] });
      j++;
    }
  }
  while (i < m) ops.push({ kind: "remove", text: a[i++] });
  while (j < n) ops.push({ kind: "add", text: b[j++] });
  return ops;
}

export function ParagraphDiff({
  original,
  revised,
}: {
  original: string;
  revised: string;
}) {
  const a = splitParagraphs(original);
  const b = splitParagraphs(revised);
  const ops = lcsDiff(a, b);

  const removed = ops.filter((o) => o.kind === "remove").length;
  const added = ops.filter((o) => o.kind === "add").length;
  const unchanged = ops.filter((o) => o.kind === "equal").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          <span className="text-emerald-700 font-medium">+{added}</span> added ·{" "}
          <span className="text-red-700 font-medium">−{removed}</span> removed ·{" "}
          {unchanged} unchanged
        </span>
        <span className="text-muted-foreground/70">
          (paragraph-level; rewritten paragraphs appear as one removed plus
          one added)
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2">
          <header className="text-xs uppercase tracking-wide text-muted-foreground">
            Original
          </header>
          <div className="rounded-md bg-muted/40 p-4 max-h-[60vh] overflow-y-auto space-y-3 text-sm leading-relaxed font-sans">
            {ops
              .filter((o) => o.kind !== "add")
              .map((o, i) => (
                <p
                  key={i}
                  className={`whitespace-pre-wrap ${
                    o.kind === "remove"
                      ? "bg-red-50 text-red-900/90 px-2 py-1 rounded"
                      : ""
                  }`}
                >
                  {o.text}
                </p>
              ))}
          </div>
        </section>

        <section className="space-y-2">
          <header className="text-xs uppercase tracking-wide text-muted-foreground">
            Revised
          </header>
          <div className="rounded-md bg-emerald-50/40 p-4 max-h-[60vh] overflow-y-auto space-y-3 text-sm leading-relaxed font-sans">
            {ops
              .filter((o) => o.kind !== "remove")
              .map((o, i) => (
                <p
                  key={i}
                  className={`whitespace-pre-wrap ${
                    o.kind === "add"
                      ? "bg-emerald-50 text-emerald-900 px-2 py-1 rounded"
                      : ""
                  }`}
                >
                  {o.text}
                </p>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
