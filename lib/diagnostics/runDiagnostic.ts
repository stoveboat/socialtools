import { DIMENSION_PROMPTS } from "./prompts";
import { buildContext, gradeDimension, runPhase0 } from "./grade";
import type {
  ChannelContext,
  DiagnosticReport,
  DimensionGrade,
  OverallLabel,
  RoutingRecommendation,
} from "./types";

export interface RunDiagnosticOptions {
  script: string;
  audience?: string;
  channel?: string;
  traction?: string;
  onDimensionComplete?: (grade: DimensionGrade) => void;
  onPhase0Complete?: (context: ChannelContext) => void;
}

// Foundation vs execution split per 02_architecture.md.
const FOUNDATION_DIMENSIONS = new Set<DimensionGrade["dimension_id"]>([
  "spine",
  "audience",
  "tension",
  "payoff",
  "authority",
]);

function isWeak(grade: DimensionGrade): boolean {
  return grade.grade === "C" || grade.grade === "D" || grade.grade === "F";
}

// Routing rules from 02_architecture.md, evaluated top-to-bottom (first match
// wins):
// 1. Ready to Ship  - all grades B or above.
// 2. Back to Phase 0 - 3+ weak foundation grades, OR Spine specifically at F.
// 3. Skeleton Mode  - 1-2 weak foundation grades, OR foundation sound but 5+
//                     execution dimensions weak.
// 4. Surgical Repair - foundation sound, 4 or fewer execution weak.
function classify(grades: DimensionGrade[]): {
  overall: OverallLabel;
  routing: RoutingRecommendation;
} {
  const foundation = grades.filter((g) =>
    FOUNDATION_DIMENSIONS.has(g.dimension_id),
  );
  const execution = grades.filter(
    (g) => !FOUNDATION_DIMENSIONS.has(g.dimension_id),
  );
  const weakFoundation = foundation.filter(isWeak);
  const weakExecution = execution.filter(isWeak);
  const spineGrade = grades.find((g) => g.dimension_id === "spine")?.grade;

  if (weakFoundation.length === 0 && weakExecution.length === 0) {
    return { overall: "Strong", routing: "ready_to_ship" };
  }
  if (weakFoundation.length >= 3 || spineGrade === "F") {
    return { overall: "Needs Work", routing: "back_to_phase_0" };
  }
  if (
    weakFoundation.length >= 1 ||
    (weakFoundation.length === 0 && weakExecution.length >= 5)
  ) {
    return { overall: "Needs Work", routing: "skeleton_mode" };
  }
  return { overall: "Mixed", routing: "surgical_repair" };
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export async function runDiagnostic(
  opts: RunDiagnosticOptions,
): Promise<DiagnosticReport> {
  const phase0 = await runPhase0(opts.script);
  const context = buildContext(phase0, {
    audience: opts.audience,
    channel: opts.channel,
    traction: opts.traction,
  });
  opts.onPhase0Complete?.(context);

  const vars: Record<string, string> = {
    script: opts.script,
    audience: context.audience,
    channel: context.channel,
    traction: context.traction,
    topic_summary: context.topic_summary,
  };

  const dimension_grades = await Promise.all(
    DIMENSION_PROMPTS.map(async (prompt) => {
      const grade = await gradeDimension(prompt, vars);
      opts.onDimensionComplete?.(grade);
      return grade;
    }),
  );

  const { overall, routing } = classify(dimension_grades);
  const word_count = countWords(opts.script);

  return {
    script: opts.script,
    word_count,
    estimated_seconds: Math.round((word_count * 60) / 150),
    phase_0: phase0,
    context,
    dimension_grades,
    overall_label: overall,
    routing_recommendation: routing,
    ran_at: new Date().toISOString(),
  };
}
