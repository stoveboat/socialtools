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

// The caption reel in this product is a 7-second looping vertical video
// where the entire visual surface is a wall of text (15-25 words target,
// up to 35-40 max). The text takes 10-15 seconds to read; the loop forces
// rereading. Success criteria: shareability, commentability, rereadability.
//
// If the source talking head doesn't contain a claimable observation
// strong enough to anchor a wall, claimable_observation_found is false
// and the wall fields will be empty/explanatory — the UI surfaces this
// honestly rather than forcing flat output.
export interface CaptionReelBrief {
  claimable_observation_found: boolean;
  claimable_observation_explanation: string;
  wall_text: string;
  word_count: number;
  estimated_read_time_seconds: number;
  screenshot_line: string;
  first_line_function: string;
  rereading_layers: string;
  share_trigger: string;
  comment_trigger: string;
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

// Caption reel intentionally has no register options — the format is the
// wall mechanic itself, and the directional choice is non-negotiables (a
// free-text input handled by CaptionReelPanel), not a register radio.
export const REGISTERS_BY_FORMAT: Record<
  Exclude<DerivationFormat, "caption_reel">,
  RegisterOption[]
> = {
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
