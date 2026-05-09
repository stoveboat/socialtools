export type Grade = "A" | "B" | "C" | "D" | "F";

export type DimensionId =
  | "spine"
  | "audience"
  | "tension"
  | "payoff"
  | "authority"
  | "hook"
  | "structure"
  | "specificity"
  | "compression"
  | "voice"
  | "off_positioning";

export interface DimensionGrade {
  dimension_id: DimensionId;
  dimension_name: string;
  grade: Grade;
  evidence: string;
  repair_suggestion: string;
}

export interface Phase0Inference {
  topic_summary: string;
  audience_candidates: string[];
  channel_candidates: string[];
  is_low_confidence: boolean;
  evidence_notes: string;
}

export interface ChannelContext {
  audience: string;
  channel: string;
  traction: string;
  topic_summary: string;
}

export type RoutingRecommendation =
  | "ready_to_ship"
  | "surgical_repair"
  | "skeleton_mode"
  | "back_to_phase_0";

export type OverallLabel = "Strong" | "Mixed" | "Needs Work";

export interface DiagnosticReport {
  script: string;
  word_count: number;
  estimated_seconds: number;
  phase_0: Phase0Inference;
  context: ChannelContext;
  dimension_grades: DimensionGrade[];
  overall_label: OverallLabel;
  routing_recommendation: RoutingRecommendation;
  ran_at: string;
}

// ============================================================================
// Derivation (Phase 4) types
// ============================================================================

export type DerivationFormat = "carousel" | "caption_reel" | "voiceover_broll";

export interface CarouselBrief {
  cover_slide: { headline: string };
  interior_slides: { slide_number: number; headline: string; body: string }[];
  final_slide: { cta: string };
  design_notes: string;
}

export interface CaptionReelBrief {
  text_cards: {
    card_number: number;
    text: string;
    duration_seconds: number;
    broll_suggestion: string;
  }[];
  music_recommendation: string;
  production_notes: string;
}

export interface VoiceoverBrief {
  audio_script: string;
  broll_timeline: {
    timestamp_start: string;
    timestamp_end: string;
    broll_description: string;
    purpose: string;
  }[];
  pacing_notes: string;
  audio_treatment_notes: string;
}

export type BriefContent = CarouselBrief | CaptionReelBrief | VoiceoverBrief;

export interface LiteDiagnosticVerdict {
  level: "ready" | "single_weakness" | "multiple_weaknesses";
  message: string;
  weak_dimensions: { dimension_id: DimensionId; grade: Grade; evidence: string }[];
}

export const REGISTERS_BY_FORMAT: Record<DerivationFormat, string[]> = {
  carousel: ["Textbook", "Friend in Textbook", "Mirror in Textbook"],
  caption_reel: [
    "Mirror",
    "Mirror with sharpened tension",
    "Friend",
  ],
  voiceover_broll: ["Friend (re-recorded VO)", "Professor extended (Interview Cut)"],
};

export const FORMAT_LABEL: Record<DerivationFormat, string> = {
  carousel: "Carousel",
  caption_reel: "Caption Reel",
  voiceover_broll: "Voiceover with B-Roll",
};
