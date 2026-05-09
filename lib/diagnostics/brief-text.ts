import type {
  BriefContent,
  CaptionReelBrief,
  CarouselBrief,
  DerivationFormat,
  VoiceoverBrief,
} from "./types";
import { FORMAT_LABEL } from "./types";

function carouselToText(b: CarouselBrief, register: string): string {
  const lines: string[] = [];
  lines.push(`# Carousel — ${register}`);
  lines.push("");
  lines.push(`## Cover slide`);
  lines.push(b.cover_slide.headline);
  lines.push("");
  for (const s of b.interior_slides) {
    lines.push(`## Slide ${s.slide_number} — ${s.headline}`);
    lines.push(s.body);
    lines.push("");
  }
  lines.push(`## Final slide (CTA)`);
  lines.push(b.final_slide.cta);
  if (b.design_notes) {
    lines.push("");
    lines.push(`---`);
    lines.push(`Design notes: ${b.design_notes}`);
  }
  return lines.join("\n");
}

function captionReelToText(b: CaptionReelBrief, register: string): string {
  const lines: string[] = [];
  lines.push(`# Caption Reel — ${register}`);
  lines.push("");
  if (b.music_recommendation) {
    lines.push(`Music: ${b.music_recommendation}`);
    lines.push("");
  }
  for (const c of b.text_cards) {
    lines.push(
      `## Card ${c.card_number} (${c.duration_seconds}s)`,
    );
    lines.push(`Text: ${c.text}`);
    lines.push(`B-roll: ${c.broll_suggestion}`);
    lines.push("");
  }
  if (b.production_notes) {
    lines.push(`---`);
    lines.push(`Production notes: ${b.production_notes}`);
  }
  return lines.join("\n");
}

function voiceoverToText(b: VoiceoverBrief, register: string): string {
  const lines: string[] = [];
  lines.push(`# Voiceover with B-Roll — ${register}`);
  lines.push("");
  lines.push(`## Audio script`);
  lines.push(b.audio_script);
  lines.push("");
  lines.push(`## B-roll timeline`);
  for (const e of b.broll_timeline) {
    lines.push(
      `[${e.timestamp_start}–${e.timestamp_end}] ${e.broll_description} — ${e.purpose}`,
    );
  }
  lines.push("");
  if (b.pacing_notes) {
    lines.push(`Pacing: ${b.pacing_notes}`);
  }
  if (b.audio_treatment_notes) {
    lines.push(`Audio treatment: ${b.audio_treatment_notes}`);
  }
  return lines.join("\n");
}

export function briefToText(
  format: DerivationFormat,
  register: string,
  content: BriefContent,
): string {
  if (format === "carousel") return carouselToText(content as CarouselBrief, register);
  if (format === "caption_reel")
    return captionReelToText(content as CaptionReelBrief, register);
  return voiceoverToText(content as VoiceoverBrief, register);
}

export function briefFilename(
  format: DerivationFormat,
  register: string,
): string {
  const slugRegister = register
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${FORMAT_LABEL[format].toLowerCase().replace(/\s+/g, "-")}-${slugRegister}.md`;
}
