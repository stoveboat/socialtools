import { GradeBadge } from "@/components/grade-badge";
import type { Grade } from "@/lib/diagnostics/types";

const GRADE_RANK: Record<Grade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };

const DIMENSION_DISPLAY_ORDER = [
  "hook",
  "tension",
  "spine",
  "audience",
  "authority",
  "voice",
  "structure",
  "specificity",
  "compression",
  "off_positioning",
  "payoff",
];

const SHORT_NAME: Record<string, string> = {
  spine: "Spine",
  audience: "Audience",
  tension: "Tension",
  payoff: "Payoff",
  authority: "Authority",
  hook: "Hook",
  structure: "Structure",
  specificity: "Specificity",
  compression: "Compression",
  voice: "Voice",
  off_positioning: "Positioning",
};

export interface GradeRow {
  dimension_id: string;
  grade: Grade;
}

interface GradeStripProps {
  initial: GradeRow[];
  current: GradeRow[];
  highlightDimensionId?: string;
}

export function GradeStrip({
  initial,
  current,
  highlightDimensionId,
}: GradeStripProps) {
  const initialByDim = new Map(initial.map((g) => [g.dimension_id, g.grade]));
  const currentByDim = new Map(current.map((g) => [g.dimension_id, g.grade]));

  let improved = 0;
  let regressed = 0;
  for (const [id, c] of currentByDim) {
    const i = initialByDim.get(id);
    if (!i) continue;
    if (GRADE_RANK[c] > GRADE_RANK[i]) improved++;
    else if (GRADE_RANK[c] < GRADE_RANK[i]) regressed++;
  }

  const ordered = DIMENSION_DISPLAY_ORDER.filter((id) =>
    currentByDim.has(id),
  );

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Current grades · script position order</span>
        <span>
          {improved > 0 ? (
            <span className="text-emerald-700">↑ {improved} improved</span>
          ) : null}
          {improved > 0 && regressed > 0 ? " · " : ""}
          {regressed > 0 ? (
            <span className="text-red-700">↓ {regressed} regressed</span>
          ) : null}
          {improved === 0 && regressed === 0
            ? "no changes from initial"
            : null}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ordered.map((id) => {
          const c = currentByDim.get(id) as Grade;
          const i = initialByDim.get(id);
          const delta = i ? GRADE_RANK[c] - GRADE_RANK[i] : 0;
          const isHighlighted = id === highlightDimensionId;
          return (
            <span
              key={id}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                isHighlighted
                  ? "border-foreground bg-background"
                  : "bg-background/60"
              }`}
            >
              <GradeBadge grade={c} className="h-5 min-w-5 text-xs px-1.5" />
              <span>{SHORT_NAME[id] ?? id}</span>
              {delta !== 0 ? (
                <span
                  className={`text-xs font-medium ${
                    delta > 0 ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}
