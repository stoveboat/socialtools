import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DIMENSION_PROMPTS } from "@/lib/diagnostics/prompts";
import { gradeDimension } from "@/lib/diagnostics/grade";
import type {
  DimensionGrade,
  LiteDiagnosticVerdict,
} from "@/lib/diagnostics/types";

export const maxDuration = 60;

const FOUNDATION = new Set(["spine", "audience", "tension", "payoff", "authority"]);

function classifyLite(grades: DimensionGrade[]): LiteDiagnosticVerdict {
  const weak = grades.filter(
    (g) => g.grade === "C" || g.grade === "D" || g.grade === "F",
  );
  const weak_dimensions = weak.map((g) => ({
    dimension_id: g.dimension_id,
    grade: g.grade,
    evidence: g.evidence,
  }));
  if (weak.length === 0) {
    return {
      level: "ready",
      message:
        "This script is in good shape to derive — the foundation grades are all B or above.",
      weak_dimensions: [],
    };
  }
  if (weak.length === 1) {
    return {
      level: "single_weakness",
      message: `This script has one foundation issue (${weak[0].dimension_name} graded ${weak[0].grade}) that may weaken the derived formats. You can fix it first or proceed anyway.`,
      weak_dimensions,
    };
  }
  return {
    level: "multiple_weaknesses",
    message:
      "This script has multiple foundation issues that will compound across all four formats. We strongly recommend running the full diagnostic and refining first.",
    weak_dimensions,
  };
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: pieceId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: piece } = await supabase
    .from("pieces")
    .select("id, source_script, user_id")
    .eq("id", pieceId)
    .single();
  if (!piece) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (piece.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: ctx } = await supabase
    .from("phase_0_contexts")
    .select(
      "topic_summary, audience_selection, custom_audience, channel_selection, custom_channel, traction_selection, custom_traction",
    )
    .eq("piece_id", pieceId)
    .single();
  const audience = ctx?.custom_audience || ctx?.audience_selection || "Unknown";
  const channel = ctx?.custom_channel || ctx?.channel_selection || "Unknown";
  const traction = ctx?.custom_traction || ctx?.traction_selection || "Unknown";
  const topic_summary = ctx?.topic_summary || "";

  const foundationPrompts = DIMENSION_PROMPTS.filter((p) =>
    FOUNDATION.has(p.id),
  );

  const vars: Record<string, string> = {
    script: piece.source_script,
    audience,
    channel,
    traction,
    topic_summary,
  };

  let grades: DimensionGrade[];
  try {
    grades = await Promise.all(
      foundationPrompts.map((p) => gradeDimension(p, vars)),
    );
  } catch (err) {
    return NextResponse.json(
      { error: "grading_failed", detail: (err as Error).message },
      { status: 500 },
    );
  }

  const verdict = classifyLite(grades);
  return NextResponse.json({ verdict, grades });
}
