// Hand-written subset of the Postgres schema. Keep in sync with
// supabase/migrations/20260509000000_initial_schema.sql.

export type Phase =
  | "phase_0"
  | "decision_screen"
  | "phase_1"
  | "phase_2"
  | "phase_3"
  | "phase_4"
  | "skeleton_mode"
  | "back_to_phase_0"
  | "completed";

export interface PieceRow {
  id: string;
  user_id: string;
  title: string;
  current_phase: Phase;
  source_script: string;
  refined_script: string | null;
  word_count: number;
  estimated_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface Phase0ContextRow {
  id: string;
  piece_id: string;
  topic_summary: string | null;
  audience_candidates: string[] | null;
  channel_candidates: string[] | null;
  is_low_confidence: boolean | null;
  evidence_notes: string | null;
  audience_selection: string | null;
  custom_audience: string | null;
  channel_selection: string | null;
  custom_channel: string | null;
  traction_selection: string | null;
  custom_traction: string | null;
  created_at: string;
}
