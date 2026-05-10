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

export type CarouselSubgenre =
  | "explainer"
  | "vulnerable_list"
  | "contrarian_list"
  | "uncertain";

// Carousels optimise for SAVES, with shares secondary. The format's primary
// engagement engine is the micro-cliffhanger between slides — each slide
// must end in a way that creates pull to the next. Three mechanically
// distinct subgenres, with different slide-shape rules:
//
//   explainer      - tactical content, mistake-framing. Headline + body.
//   vulnerable_list - bare admissions. Headline only; silence is the writing.
//   contrarian_list - position claims. Headline + optional 1-line amplification.
//
// The model auto-detects the subgenre from the source but the user's
// register selection during Convert configuration acts as an intent override.
export interface CarouselBrief {
  subgenre: CarouselSubgenre;
  subgenre_reasoning: string;
  cover_slide: {
    headline: string;
    headline_word_count: number;
    earns_swipe: string;
  };
  interior_slides: {
    slide_number: number;
    headline: string;
    body: string;
    pull_to_next: string;
  }[];
  final_slide: {
    cta_type: "save" | "follow" | "comment" | "soft_signoff";
    cta_text: string;
    cta_reasoning: string;
  };
  design_notes: string;
  loss_aversion_opportunity: string;
}

// Caption reel has two mechanically distinct variants. The user picks based
// on what they're trying to accomplish.
//
//   wall              - 7-second looping wall of text (15-25 words). Loop
//                       forces rereading. Optimises for shareability,
//                       commentability, rereadability. Best when the source
//                       has a single claimable observation that can be
//                       compressed extreme.
//   sequential_cards  - 15-30 second card-based reel (3-8 text cards with
//                       per-card durations and b-roll). Closer to the
//                       talking head's structure. Optimises for retention
//                       and visual-rhythm comprehension. Best when the
//                       source has multiple beats worth carrying through.

// Wall variant — the high-compression loop format.
export interface CaptionReelWallBrief {
  variant: "wall";
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

// Sequential cards variant — closer to the original talking-head structure,
// expressed as 3-8 silent-friendly text cards with b-roll suggestions.
export interface CaptionReelSequentialBrief {
  variant: "sequential_cards";
  text_cards: {
    card_number: number;
    text: string;
    duration_seconds: number;
    broll_suggestion: string;
  }[];
  music_recommendation: string;
  production_notes: string;
}

export type CaptionReelBrief =
  | CaptionReelWallBrief
  | CaptionReelSequentialBrief;

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

// Caption reel registers are now the two variants. The user picks based on
// what they're trying to make. Voiceover registers map to its two variants
// the same way.
export const REGISTERS_BY_FORMAT: Record<DerivationFormat, RegisterOption[]> = {
  carousel: [
    {
      name: "Explainer",
      oneliner:
        "Tactical reference. Each slide states a claim and explains it briefly.",
      example:
        "\"5 mistakes I made starting [X] (so you don't have to)\". Mistake-framing typically saves harder than positive framing — use when the source supports it.",
    },
    {
      name: "Vulnerable List",
      oneliner:
        "Bare admissions. Each slide is a single statement; the silence after it IS the writing.",
      example:
        "\"Thoughts I have as a [X] that I never say out loud.\" Slides do NOT have body explanation — explanation dilutes the format.",
    },
    {
      name: "Contrarian List",
      oneliner:
        "Position claims. Each slide stakes ground; the carousel is what the reader stands for.",
      example:
        "\"Things I refuse to feel guilty about as a [X].\" Sharp, declarative. Save-trigger is tribe-flag — the reader saves to claim the position.",
    },
  ],
  caption_reel: [
    {
      name: "Wall of text loop",
      oneliner:
        "7-second looping wall (15-25 words). Loop forces rereading. Optimises for shareability and comments.",
      example:
        "Single dense block. Specific enough that the reader instantly thinks of one person to send it to. Best when the talking head has one claimable observation that compresses hard.",
    },
    {
      name: "Sequential cards",
      oneliner:
        "15-30 second card reel (3-8 text cards with b-roll). Closer to the talking head's structure.",
      example:
        "Each card a complete thought that lands silently. Music bed underneath. Best when the talking head has multiple beats worth carrying through, or when the audience needs visual rhythm to retain the message.",
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
