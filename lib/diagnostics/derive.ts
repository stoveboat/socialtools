import { getLLMClient, GRADING_MODEL } from "../llm";
import {
  CAPTION_REEL_SEQUENTIAL_SYSTEM_PROMPT,
  CAPTION_REEL_SEQUENTIAL_USER_PROMPT,
  CAPTION_REEL_WALL_SYSTEM_PROMPT,
  CAPTION_REEL_WALL_USER_PROMPT,
  CAROUSEL_SYSTEM_PROMPT,
  CAROUSEL_USER_PROMPT,
  FRIEND_VO_SYSTEM_PROMPT,
  FRIEND_VO_USER_PROMPT,
  INTERVIEW_CUT_SYSTEM_PROMPT,
  INTERVIEW_CUT_USER_PROMPT,
  fillTemplate,
} from "./prompts";
import type {
  BriefContent,
  CaptionReelBrief,
  CaptionReelSequentialBrief,
  CaptionReelWallBrief,
  CarouselBrief,
  ChannelContext,
  DerivationFormat,
  FriendVOBrief,
  InterviewCutBrief,
  VoiceoverBrief,
} from "./types";

// Each register-bearing format branches its prompt + validator on the user's
// register choice. Carousel uses a single prompt with the subgenre as input.

type CaptionReelVariant = "wall" | "sequential_cards";
type VoiceoverVariant = "interview_cut" | "friend_vo";
type Variant = CaptionReelVariant | VoiceoverVariant;

function pickCaptionReelVariant(register: string): CaptionReelVariant {
  // "Sequential cards" → sequential_cards. Default to wall for the empty
  // string, "Wall of text loop", or any unrecognised value.
  return register.toLowerCase().includes("sequential")
    ? "sequential_cards"
    : "wall";
}

function pickVoiceoverVariant(register: string): VoiceoverVariant {
  return register.toLowerCase().includes("interview")
    ? "interview_cut"
    : "friend_vo";
}

class BriefValidationError extends Error {
  constructor(message: string, readonly raw: string) {
    super(message);
  }
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === "string");
}

const VALID_SUBGENRES = new Set([
  "explainer",
  "vulnerable_list",
  "contrarian_list",
  "uncertain",
]);

const VALID_CTA_TYPES = new Set([
  "save",
  "follow",
  "comment",
  "soft_signoff",
]);

function validateCarousel(parsed: unknown): CarouselBrief {
  if (!parsed || typeof parsed !== "object") {
    throw new BriefValidationError("Not an object", JSON.stringify(parsed));
  }
  const o = parsed as Record<string, unknown>;

  const subgenre =
    typeof o.subgenre === "string" && VALID_SUBGENRES.has(o.subgenre)
      ? (o.subgenre as CarouselBrief["subgenre"])
      : "uncertain";

  const cover = o.cover_slide as Record<string, unknown> | undefined;
  if (!cover || typeof cover.headline !== "string") {
    throw new BriefValidationError("cover_slide.headline missing", "");
  }
  const headlineWordCount =
    typeof cover.headline_word_count === "number"
      ? cover.headline_word_count
      : cover.headline.trim().split(/\s+/).length;

  if (!Array.isArray(o.interior_slides) || o.interior_slides.length === 0) {
    throw new BriefValidationError("interior_slides must be a non-empty array", "");
  }
  const slides: CarouselBrief["interior_slides"] = [];
  for (const s of o.interior_slides as Record<string, unknown>[]) {
    if (typeof s.slide_number !== "number" || typeof s.headline !== "string") {
      throw new BriefValidationError("interior_slide entry malformed", "");
    }
    slides.push({
      slide_number: s.slide_number,
      headline: s.headline,
      body: typeof s.body === "string" ? s.body : "",
      pull_to_next: typeof s.pull_to_next === "string" ? s.pull_to_next : "",
    });
  }

  const final = o.final_slide as Record<string, unknown> | undefined;
  if (!final) {
    throw new BriefValidationError("final_slide missing", "");
  }
  const ctaType =
    typeof final.cta_type === "string" && VALID_CTA_TYPES.has(final.cta_type)
      ? (final.cta_type as CarouselBrief["final_slide"]["cta_type"])
      : "save";
  const ctaText =
    typeof final.cta_text === "string"
      ? final.cta_text
      : typeof final.cta === "string"
        ? final.cta // tolerant of model returning legacy `cta` field
        : "";
  if (!ctaText) {
    throw new BriefValidationError("final_slide.cta_text missing", "");
  }

  return {
    subgenre,
    subgenre_reasoning:
      typeof o.subgenre_reasoning === "string" ? o.subgenre_reasoning : "",
    cover_slide: {
      headline: cover.headline,
      headline_word_count: headlineWordCount,
      earns_swipe:
        typeof cover.earns_swipe === "string" ? cover.earns_swipe : "",
    },
    interior_slides: slides,
    final_slide: {
      cta_type: ctaType,
      cta_text: ctaText,
      cta_reasoning:
        typeof final.cta_reasoning === "string" ? final.cta_reasoning : "",
    },
    design_notes: typeof o.design_notes === "string" ? o.design_notes : "",
    loss_aversion_opportunity:
      typeof o.loss_aversion_opportunity === "string"
        ? o.loss_aversion_opportunity
        : "",
  };
}

function validateCaptionReelWall(parsed: unknown): CaptionReelWallBrief {
  if (!parsed || typeof parsed !== "object") {
    throw new BriefValidationError("Not an object", JSON.stringify(parsed));
  }
  const o = parsed as Record<string, unknown>;

  const claimable = o.claimable_observation_found === true;
  const explanation =
    typeof o.claimable_observation_explanation === "string"
      ? o.claimable_observation_explanation
      : "";

  // When the model says the script can't anchor a wall, allow empty wall
  // content. The UI surfaces the explanation rather than forcing flat output.
  if (!claimable) {
    return {
      variant: "wall",
      claimable_observation_found: false,
      claimable_observation_explanation: explanation,
      wall_text: "",
      word_count: 0,
      estimated_read_time_seconds: 0,
      screenshot_line: "",
      first_line_function: "",
      rereading_layers: "",
      share_trigger: "",
      comment_trigger: "",
      production_notes:
        typeof o.production_notes === "string" ? o.production_notes : "",
    };
  }

  if (typeof o.wall_text !== "string" || o.wall_text.trim() === "") {
    throw new BriefValidationError(
      "wall_text required when claimable_observation_found=true",
      "",
    );
  }
  const wordCount =
    typeof o.word_count === "number"
      ? o.word_count
      : o.wall_text.trim().split(/\s+/).length;
  return {
    variant: "wall",
    claimable_observation_found: true,
    claimable_observation_explanation: explanation,
    wall_text: o.wall_text,
    word_count: wordCount,
    estimated_read_time_seconds:
      typeof o.estimated_read_time_seconds === "number"
        ? o.estimated_read_time_seconds
        : Math.round(wordCount / 3),
    screenshot_line:
      typeof o.screenshot_line === "string" ? o.screenshot_line : "",
    first_line_function:
      typeof o.first_line_function === "string" ? o.first_line_function : "",
    rereading_layers:
      typeof o.rereading_layers === "string" ? o.rereading_layers : "",
    share_trigger:
      typeof o.share_trigger === "string" ? o.share_trigger : "",
    comment_trigger:
      typeof o.comment_trigger === "string" ? o.comment_trigger : "",
    production_notes:
      typeof o.production_notes === "string" ? o.production_notes : "",
  };
}

function validateCaptionReelSequential(
  parsed: unknown,
): CaptionReelSequentialBrief {
  if (!parsed || typeof parsed !== "object") {
    throw new BriefValidationError("Not an object", JSON.stringify(parsed));
  }
  const o = parsed as Record<string, unknown>;
  if (!Array.isArray(o.text_cards) || o.text_cards.length === 0) {
    throw new BriefValidationError("text_cards must be a non-empty array", "");
  }
  for (const c of o.text_cards as Record<string, unknown>[]) {
    if (
      typeof c.card_number !== "number" ||
      typeof c.text !== "string" ||
      typeof c.duration_seconds !== "number" ||
      typeof c.broll_suggestion !== "string"
    ) {
      throw new BriefValidationError("text_card entry malformed", "");
    }
  }
  return {
    variant: "sequential_cards",
    text_cards: o.text_cards as CaptionReelSequentialBrief["text_cards"],
    music_recommendation:
      typeof o.music_recommendation === "string"
        ? o.music_recommendation
        : "",
    production_notes:
      typeof o.production_notes === "string" ? o.production_notes : "",
  };
  void isStringArray;
}

function validateBrollTimeline(value: unknown): VoiceoverBrief["broll_timeline"] {
  if (!Array.isArray(value)) {
    throw new BriefValidationError("broll_timeline must be an array", "");
  }
  for (const b of value as Record<string, unknown>[]) {
    if (
      typeof b.timestamp_start !== "string" ||
      typeof b.timestamp_end !== "string" ||
      typeof b.broll_description !== "string" ||
      typeof b.purpose !== "string"
    ) {
      throw new BriefValidationError("broll_timeline entry malformed", "");
    }
  }
  return value as VoiceoverBrief["broll_timeline"];
}

function validateInterviewCut(parsed: unknown): InterviewCutBrief {
  if (!parsed || typeof parsed !== "object") {
    throw new BriefValidationError("Not an object", JSON.stringify(parsed));
  }
  const o = parsed as Record<string, unknown>;
  if (!Array.isArray(o.selected_sentences) || o.selected_sentences.length === 0) {
    throw new BriefValidationError(
      "selected_sentences must be a non-empty array",
      "",
    );
  }
  for (const s of o.selected_sentences as Record<string, unknown>[]) {
    if (
      typeof s.sentence_number !== "number" ||
      typeof s.talking_head_sentence !== "string" ||
      typeof s.estimated_duration_seconds !== "number"
    ) {
      throw new BriefValidationError(
        "selected_sentences entry malformed",
        "",
      );
    }
  }
  const broll = validateBrollTimeline(o.broll_timeline ?? []);
  const cutbacks = Array.isArray(o.talking_head_cutbacks)
    ? (o.talking_head_cutbacks as Record<string, unknown>[]).map((c) => ({
        timestamp: typeof c.timestamp === "string" ? c.timestamp : "",
        purpose: typeof c.purpose === "string" ? c.purpose : "",
      }))
    : [];
  return {
    variant: "interview_cut",
    format_fit_assessment:
      typeof o.format_fit_assessment === "string"
        ? o.format_fit_assessment
        : "",
    selected_sentences: o.selected_sentences as InterviewCutBrief["selected_sentences"],
    sentences_cut: isStringArray(o.sentences_cut) ? o.sentences_cut : [],
    broll_timeline: broll,
    text_overlay_phrases: isStringArray(o.text_overlay_phrases)
      ? o.text_overlay_phrases
      : [],
    talking_head_cutbacks: cutbacks,
    estimated_total_duration_seconds:
      typeof o.estimated_total_duration_seconds === "number"
        ? o.estimated_total_duration_seconds
        : 0,
    production_notes:
      typeof o.production_notes === "string" ? o.production_notes : "",
  };
}

function validateFriendVO(parsed: unknown): FriendVOBrief {
  if (!parsed || typeof parsed !== "object") {
    throw new BriefValidationError("Not an object", JSON.stringify(parsed));
  }
  const o = parsed as Record<string, unknown>;
  if (typeof o.audio_script !== "string" || o.audio_script.trim() === "") {
    throw new BriefValidationError("audio_script missing", "");
  }
  const arc = (o.structural_arc as Record<string, unknown>) ?? {};
  return {
    variant: "friend_vo",
    friend_material_assessment:
      typeof o.friend_material_assessment === "string"
        ? o.friend_material_assessment
        : "",
    extracted_vulnerability_beat:
      typeof o.extracted_vulnerability_beat === "string"
        ? o.extracted_vulnerability_beat
        : "",
    audio_script: o.audio_script,
    word_count:
      typeof o.word_count === "number"
        ? o.word_count
        : o.audio_script.trim().split(/\s+/).length,
    estimated_duration_seconds:
      typeof o.estimated_duration_seconds === "number"
        ? o.estimated_duration_seconds
        : 0,
    structural_arc: {
      drop_in_opener:
        typeof arc.drop_in_opener === "string" ? arc.drop_in_opener : "",
      escalation:
        typeof arc.escalation === "string" ? arc.escalation : "",
      vulnerability_beat:
        typeof arc.vulnerability_beat === "string"
          ? arc.vulnerability_beat
          : "",
      reflection: typeof arc.reflection === "string" ? arc.reflection : "",
      implicit_invitation:
        typeof arc.implicit_invitation === "string"
          ? arc.implicit_invitation
          : "",
    },
    broll_timeline: validateBrollTimeline(o.broll_timeline ?? []),
    audio_treatment_notes:
      typeof o.audio_treatment_notes === "string"
        ? o.audio_treatment_notes
        : "",
    comment_trigger:
      typeof o.comment_trigger === "string" ? o.comment_trigger : "",
  };
}

function validateBrief(
  format: DerivationFormat,
  variant: Variant | null,
  raw: string,
): BriefContent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BriefValidationError("Not valid JSON", raw);
  }
  if (format === "carousel") return validateCarousel(parsed);
  if (format === "caption_reel") {
    return variant === "sequential_cards"
      ? validateCaptionReelSequential(parsed)
      : validateCaptionReelWall(parsed);
  }
  if (variant === "interview_cut") return validateInterviewCut(parsed);
  return validateFriendVO(parsed);
}

async function callOnce(
  system: string,
  user: string,
  temperature: number,
): Promise<string> {
  const client = getLLMClient();
  const response = await client.chat.completions.create({
    model: GRADING_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature,
  });
  const content = response.choices[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new Error("Empty response from model");
  }
  return content;
}

export interface GenerateBriefOptions {
  // For carousel and voiceover_broll: the user's chosen register name. The
  // voiceover variant is derived from this string.
  register?: string;
  // For caption_reel and voiceover_broll: optional free-text non-negotiables
  // the user wants the model to respect.
  non_negotiables?: string;
}

function pickVoiceoverPrompts(variant: VoiceoverVariant): {
  system: string;
  user: string;
} {
  if (variant === "interview_cut") {
    return {
      system: INTERVIEW_CUT_SYSTEM_PROMPT,
      user: INTERVIEW_CUT_USER_PROMPT,
    };
  }
  return { system: FRIEND_VO_SYSTEM_PROMPT, user: FRIEND_VO_USER_PROMPT };
}

function pickCaptionReelPrompts(variant: CaptionReelVariant): {
  system: string;
  user: string;
} {
  if (variant === "sequential_cards") {
    return {
      system: CAPTION_REEL_SEQUENTIAL_SYSTEM_PROMPT,
      user: CAPTION_REEL_SEQUENTIAL_USER_PROMPT,
    };
  }
  return {
    system: CAPTION_REEL_WALL_SYSTEM_PROMPT,
    user: CAPTION_REEL_WALL_USER_PROMPT,
  };
}

export async function generateBrief(
  format: DerivationFormat,
  opts: GenerateBriefOptions,
  script: string,
  context: ChannelContext,
): Promise<BriefContent> {
  let system: string;
  let user: string;
  let variant: Variant | null = null;

  if (format === "carousel") {
    system = CAROUSEL_SYSTEM_PROMPT;
    user = CAROUSEL_USER_PROMPT;
  } else if (format === "caption_reel") {
    variant = pickCaptionReelVariant(opts.register ?? "");
    const prompts = pickCaptionReelPrompts(variant);
    system = prompts.system;
    user = prompts.user;
  } else {
    variant = pickVoiceoverVariant(opts.register ?? "");
    const prompts = pickVoiceoverPrompts(variant);
    system = prompts.system;
    user = prompts.user;
  }

  const userPrompt = fillTemplate(user, {
    register: opts.register ?? "",
    non_negotiables: opts.non_negotiables ?? "",
    script,
    audience: context.audience,
    channel: context.channel,
  });

  try {
    const raw = await callOnce(system, userPrompt, 0.4);
    return validateBrief(format, variant, raw);
  } catch (firstError) {
    const raw = await callOnce(system, userPrompt, 0.6);
    try {
      return validateBrief(format, variant, raw);
    } catch (secondError) {
      const m1 =
        firstError instanceof Error ? firstError.message : String(firstError);
      const m2 =
        secondError instanceof Error
          ? secondError.message
          : String(secondError);
      throw new Error(`Both attempts failed. First: ${m1}. Second: ${m2}`);
    }
  }
}
