import { getLLMClient, GRADING_MODEL } from "../llm";
import {
  CAPTION_REEL_SYSTEM_PROMPT,
  CAPTION_REEL_USER_PROMPT,
  CAROUSEL_SYSTEM_PROMPT,
  CAROUSEL_USER_PROMPT,
  VOICEOVER_SYSTEM_PROMPT,
  VOICEOVER_USER_PROMPT,
  fillTemplate,
} from "./prompts";
import type {
  BriefContent,
  CaptionReelBrief,
  CarouselBrief,
  ChannelContext,
  DerivationFormat,
  VoiceoverBrief,
} from "./types";

const PROMPTS: Record<DerivationFormat, { system: string; user: string }> = {
  carousel: { system: CAROUSEL_SYSTEM_PROMPT, user: CAROUSEL_USER_PROMPT },
  caption_reel: {
    system: CAPTION_REEL_SYSTEM_PROMPT,
    user: CAPTION_REEL_USER_PROMPT,
  },
  voiceover_broll: {
    system: VOICEOVER_SYSTEM_PROMPT,
    user: VOICEOVER_USER_PROMPT,
  },
};

class BriefValidationError extends Error {
  constructor(message: string, readonly raw: string) {
    super(message);
  }
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === "string");
}

function validateCarousel(parsed: unknown): CarouselBrief {
  if (!parsed || typeof parsed !== "object") {
    throw new BriefValidationError("Not an object", JSON.stringify(parsed));
  }
  const o = parsed as Record<string, unknown>;
  const cover = o.cover_slide as Record<string, unknown> | undefined;
  if (!cover || typeof cover.headline !== "string") {
    throw new BriefValidationError("cover_slide.headline missing", "");
  }
  if (!Array.isArray(o.interior_slides) || o.interior_slides.length === 0) {
    throw new BriefValidationError("interior_slides must be a non-empty array", "");
  }
  for (const s of o.interior_slides as Record<string, unknown>[]) {
    if (
      typeof s.slide_number !== "number" ||
      typeof s.headline !== "string" ||
      typeof s.body !== "string"
    ) {
      throw new BriefValidationError("interior_slide entry malformed", "");
    }
  }
  const final = o.final_slide as Record<string, unknown> | undefined;
  if (!final || typeof final.cta !== "string") {
    throw new BriefValidationError("final_slide.cta missing", "");
  }
  return {
    cover_slide: { headline: cover.headline },
    interior_slides: o.interior_slides as CarouselBrief["interior_slides"],
    final_slide: { cta: final.cta },
    design_notes: typeof o.design_notes === "string" ? o.design_notes : "",
  };
}

function validateCaptionReel(parsed: unknown): CaptionReelBrief {
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
    text_cards: o.text_cards as CaptionReelBrief["text_cards"],
    music_recommendation:
      typeof o.music_recommendation === "string"
        ? o.music_recommendation
        : "",
    production_notes:
      typeof o.production_notes === "string" ? o.production_notes : "",
  };
  void isStringArray;
}

function validateVoiceover(parsed: unknown): VoiceoverBrief {
  if (!parsed || typeof parsed !== "object") {
    throw new BriefValidationError("Not an object", JSON.stringify(parsed));
  }
  const o = parsed as Record<string, unknown>;
  if (typeof o.audio_script !== "string") {
    throw new BriefValidationError("audio_script missing", "");
  }
  if (!Array.isArray(o.broll_timeline)) {
    throw new BriefValidationError("broll_timeline must be an array", "");
  }
  for (const b of o.broll_timeline as Record<string, unknown>[]) {
    if (
      typeof b.timestamp_start !== "string" ||
      typeof b.timestamp_end !== "string" ||
      typeof b.broll_description !== "string" ||
      typeof b.purpose !== "string"
    ) {
      throw new BriefValidationError("broll_timeline entry malformed", "");
    }
  }
  return {
    audio_script: o.audio_script,
    broll_timeline: o.broll_timeline as VoiceoverBrief["broll_timeline"],
    pacing_notes: typeof o.pacing_notes === "string" ? o.pacing_notes : "",
    audio_treatment_notes:
      typeof o.audio_treatment_notes === "string"
        ? o.audio_treatment_notes
        : "",
  };
}

function validateBrief(format: DerivationFormat, raw: string): BriefContent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BriefValidationError("Not valid JSON", raw);
  }
  if (format === "carousel") return validateCarousel(parsed);
  if (format === "caption_reel") return validateCaptionReel(parsed);
  return validateVoiceover(parsed);
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

export async function generateBrief(
  format: DerivationFormat,
  register: string,
  script: string,
  context: ChannelContext,
): Promise<BriefContent> {
  const { system, user } = PROMPTS[format];
  const userPrompt = fillTemplate(user, {
    register,
    script,
    audience: context.audience,
    channel: context.channel,
  });

  try {
    const raw = await callOnce(system, userPrompt, 0.4);
    return validateBrief(format, raw);
  } catch (firstError) {
    const raw = await callOnce(system, userPrompt, 0.6);
    try {
      return validateBrief(format, raw);
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
