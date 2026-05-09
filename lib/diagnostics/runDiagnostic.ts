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

const FOUNDATION_DIMENSIONS = new Set([
  "spine",
  "audience",
  "tension",
  "payoff",
]);

function gradeRank(grade: string): number {
  return { A: 4, B: 3, C: 2, D: 1, F: 0 }[grade] ?? 0;
}

function classify(grades: DimensionGrade[]): {
  overall: OverallLabel;
  routing: RoutingRecommendation;
} {
  const foundationGrades = grades.filter((g) =>
    FOUNDATION_DIMENSIONS.has(g.dimension_id),
  );
  const failingFoundations = foundationGrades.filter(
    (g) => g.grade === "D" || g.grade === "F",
  );
  const weakAny = grades.filter((g) => g.grade === "D" || g.grade === "F");
  const polishOrBetter = grades.filter((g) => gradeRank(g.grade) >= 3);

  // Routing rules:
  // - 2+ foundation dimensions failing -> skeleton mode
  // - off_positioning failing badly -> back_to_phase_0
  // - 0 weak dimensions and 8+ A/B grades -> ready_to_ship
  // - otherwise -> surgical_repair
  if (failingFoundations.length >= 2) {
    return { overall: "Needs Work", routing: "skeleton_mode" };
  }
  const offPos = grades.find((g) => g.dimension_id === "off_positioning");
  if (offPos && offPos.grade === "F") {
    return { overall: "Needs Work", routing: "back_to_phase_0" };
  }
  if (weakAny.length === 0 && polishOrBetter.length >= 8) {
    return { overall: "Strong", routing: "ready_to_ship" };
  }
  return {
    overall: weakAny.length >= 4 ? "Needs Work" : "Mixed",
    routing: "surgical_repair",
  };
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
