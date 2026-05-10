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

function captionReelToText(b: CaptionReelBrief): string {
  const lines: string[] = [];
  lines.push(`# Caption Reel`);
  lines.push("");

  if (!b.claimable_observation_found) {
    lines.push("(no wall — script lacks a claimable observation)");
    if (b.claimable_observation_explanation) {
      lines.push("");
      lines.push(b.claimable_observation_explanation);
    }
    return lines.join("\n");
  }

  lines.push(`## Wall (${b.word_count} words, ~${b.estimated_read_time_seconds.toFixed(1)}s to read)`);
  lines.push("");
  lines.push(b.wall_text);
  lines.push("");
  lines.push("---");
  if (b.claimable_observation_explanation) {
    lines.push(`Claimable observation: ${b.claimable_observation_explanation}`);
  }
  if (b.first_line_function) {
    lines.push(`First line function: ${b.first_line_function}`);
  }
  if (b.rereading_layers) {
    lines.push(`Rereading layer: ${b.rereading_layers}`);
  }
  if (b.share_trigger) {
    lines.push(`Share trigger: ${b.share_trigger}`);
  }
  if (b.comment_trigger) {
    lines.push(`Comment trigger: ${b.comment_trigger}`);
  }
  if (b.screenshot_line) {
    lines.push(`Screenshot line: "${b.screenshot_line}"`);
  }
  if (b.production_notes) {
    lines.push("");
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
    return captionReelToText(content as CaptionReelBrief);
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
