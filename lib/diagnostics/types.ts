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

export interface RegisterOption {
  name: string;
  oneliner: string;
  example: string;
}

export const REGISTERS_BY_FORMAT: Record<DerivationFormat, RegisterOption[]> = {
  carousel: [
    {
      name: "Textbook",
      oneliner: "Pure utility, optimised to be saved and re-read.",
      example: "Dense reference card. Each slide is a definition, rule, or step.",
    },
    {
      name: "Friend in Textbook",
      oneliner: "A vulnerable list. You're admitting what you learned the hard way.",
      example: "\"5 things I wish I'd known about X — slide one is the one that cost me.\"",
    },
    {
      name: "Mirror in Textbook",
      oneliner: "A relatable list. You're naming the experience the reader already lives.",
      example: "\"6 things you'll recognise if you've ever shipped on a hard deadline.\"",
    },
  ],
  caption_reel: [
    {
      name: "Mirror",
      oneliner: "Relatable POV scenario the viewer instantly recognises.",
      example: "\"When you finally fix the bug after three hours and it was a typo.\"",
    },
    {
      name: "Mirror with sharpened tension",
      oneliner: "Contrarian observation that calls out a common belief as wrong.",
      example: "\"Everyone says do X. They're wrong. Here's why.\"",
    },
    {
      name: "Friend",
      oneliner: "Vulnerable text-driven confessional. Quieter, more intimate.",
      example: "\"I never said this out loud, but I think I've been doing it for the wrong reason.\"",
    },
  ],
  voiceover_broll: [
    {
      name: "Friend (re-recorded VO)",
      oneliner: "New audio, recorded soft and slow. Vulnerable register.",
      example: "Quieter delivery, longer pauses, more reflective tone. Re-record the audio.",
    },
    {
      name: "Professor extended (Interview Cut)",
      oneliner: "Reuse the original talking-head audio. Declarative and authoritative.",
      example: "Cut the same audio over b-roll. The voice stays sharp and certain.",
    },
  ],
};

export const FORMAT_LABEL: Record<DerivationFormat, string> = {
  carousel: "Carousel",
  caption_reel: "Caption Reel",
  voiceover_broll: "Voiceover with B-Roll",
};
