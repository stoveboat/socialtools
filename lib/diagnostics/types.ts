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

// Voiceover-with-b-roll has two mechanically distinct variants. They produce
// different artifacts (a cutting plan vs. a rewritten script) and optimise
// for different metrics (watch-time vs. comments). The `variant` field
// discriminates the union.

export interface VoiceoverBrollSegment {
  timestamp_start: string;
  timestamp_end: string;
  broll_description: string;
  purpose: string;
}

// Interview Cut Reel: original talking-head audio reused, with b-roll on
// top and 1-2 cutbacks to the talking-head face. The work is editorial —
// pick which sentences to keep and in what order, propose b-roll, identify
// 2-4 phrases for text overlay. Optimises for watch-time.
export interface InterviewCutBrief {
  variant: "interview_cut";
  format_fit_assessment: string;
  selected_sentences: {
    sentence_number: number;
    talking_head_sentence: string;
    edit_notes: string;
    estimated_duration_seconds: number;
  }[];
  sentences_cut: string[];
  broll_timeline: VoiceoverBrollSegment[];
  text_overlay_phrases: string[];
  talking_head_cutbacks: { timestamp: string; purpose: string }[];
  estimated_total_duration_seconds: number;
  production_notes: string;
}

// Re-Recorded Friend VO: fresh script in intimate register, recorded
// separately. Mandatory drop-in opener + vulnerability beat + implicit
// invitation closer. Atmospheric/metaphorical b-roll. Optimises for comments.
export interface FriendVOBrief {
  variant: "friend_vo";
  friend_material_assessment: string;
  extracted_vulnerability_beat: string;
  audio_script: string;
  word_count: number;
  estimated_duration_seconds: number;
  structural_arc: {
    drop_in_opener: string;
    escalation: string;
    vulnerability_beat: string;
    reflection: string;
    implicit_invitation: string;
  };
  broll_timeline: VoiceoverBrollSegment[];
  audio_treatment_notes: string;
  comment_trigger: string;
}

export type VoiceoverBrief = InterviewCutBrief | FriendVOBrief;

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
      oneliner:
        "Fresh, intimate script you record separately. Optimises for comments.",
      example:
        "70-110 words for ~45s. Drop-in opener, vulnerability beat, implicit invitation close. Best for confessional content where the talking head has a real failure or doubt to anchor.",
    },
    {
      name: "Professor extended (Interview Cut)",
      oneliner:
        "Editorial cutting plan over your existing talking-head audio. Optimises for watch-time.",
      example:
        "Select and re-order the talking head's strongest sentences. B-roll changes every 1.5-3s. 2-4 text overlays. 1-2 cutbacks to face. Best for explainer or expertise content.",
    },
  ],
};

export const FORMAT_LABEL: Record<DerivationFormat, string> = {
  carousel: "Carousel",
  caption_reel: "Caption Reel",
  voiceover_broll: "Voiceover with B-Roll",
};
