import { createClient } from "@/lib/supabase/server";
import type { DimensionGrade, Grade } from "@/lib/diagnostics/types";

export interface LoadedDiagnostic {
  id: string;
  piece_id: string;
  script_version: string;
  routing_recommendation: string | null;
  overall_label: string | null;
  created_at: string;
  grades: DimensionGrade[];
}

export async function loadLatestSourceDiagnostic(
  pieceId: string,
): Promise<LoadedDiagnostic | null> {
  return loadLatestDiagnostic(pieceId, "source");
}

export async function loadLatestDiagnosticAny(
  pieceId: string,
): Promise<LoadedDiagnostic | null> {
  const supabase = await createClient();
  const { data: diag } = await supabase
    .from("diagnostics")
    .select(
      "id, piece_id, script_version, routing_recommendation, overall_label, created_at",
    )
    .eq("piece_id", pieceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!diag) return null;

  const { data: gradeRows } = await supabase
    .from("dimension_grades")
    .select(
      "dimension_id, dimension_name, grade, evidence, repair_suggestion, user_overridden_grade",
    )
    .eq("diagnostic_id", diag.id);
  if (!gradeRows || gradeRows.length === 0) return null;

  const grades: DimensionGrade[] = gradeRows.map((g) => ({
    dimension_id: g.dimension_id as DimensionGrade["dimension_id"],
    dimension_name: g.dimension_name,
    grade: g.grade as Grade,
    evidence: g.evidence,
    repair_suggestion: g.repair_suggestion ?? "",
  }));

  return { ...diag, grades };
}

export async function loadLatestDiagnostic(
  pieceId: string,
  scriptVersion: string,
): Promise<LoadedDiagnostic | null> {
  const supabase = await createClient();
  const { data: diag } = await supabase
    .from("diagnostics")
    .select(
      "id, piece_id, script_version, routing_recommendation, overall_label, created_at",
    )
    .eq("piece_id", pieceId)
    .eq("script_version", scriptVersion)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!diag) return null;

  const { data: gradeRows } = await supabase
    .from("dimension_grades")
    .select(
      "dimension_id, dimension_name, grade, evidence, repair_suggestion, user_overridden_grade",
    )
    .eq("diagnostic_id", diag.id);
  if (!gradeRows || gradeRows.length === 0) return null;

  const grades: DimensionGrade[] = gradeRows.map((g) => ({
    dimension_id: g.dimension_id as DimensionGrade["dimension_id"],
    dimension_name: g.dimension_name,
    grade: g.grade as Grade,
    evidence: g.evidence,
    repair_suggestion: g.repair_suggestion ?? "",
  }));

  return { ...diag, grades };
}
