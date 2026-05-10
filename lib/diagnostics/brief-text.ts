import type {
  BriefContent,
  CaptionReelBrief,
  CarouselBrief,
  DerivationFormat,
  VoiceoverBrief,
} from "./types";
import { FORMAT_LABEL } from "./types";

function carouselToText(b: CarouselBrief, register: string): string {
  // Legacy briefs lack subgenre and use the old final_slide.cta shape.
  const hasSubgenre = !!(b as { subgenre?: string }).subgenre;
  const hasNewCta = !!(b.final_slide as { cta_text?: string }).cta_text;
  if (!hasSubgenre || !hasNewCta) {
    return `# Carousel — ${register}\n\n(Legacy brief in outdated format. Regenerate to get the current subgenre-aware artifact.)`;
  }

  const lines: string[] = [];
  const subgenreLabel = b.subgenre.replace(/_/g, " ");
  lines.push(`# Carousel — ${subgenreLabel}`);
  if (b.subgenre_reasoning) {
    lines.push("");
    lines.push(`> ${b.subgenre_reasoning}`);
  }
  lines.push("");
  lines.push(
    `## Cover slide (${b.cover_slide.headline_word_count} words)`,
  );
  lines.push(b.cover_slide.headline);
  if (b.cover_slide.earns_swipe) {
    lines.push("");
    lines.push(`_Earns the swipe: ${b.cover_slide.earns_swipe}_`);
  }
  lines.push("");
  for (const s of b.interior_slides) {
    lines.push(`## Slide ${s.slide_number} — ${s.headline}`);
    if (s.body) {
      lines.push(s.body);
    }
    lines.push("");
  }
  lines.push(`## Final slide (${b.final_slide.cta_type})`);
  lines.push(b.final_slide.cta_text);
  if (b.final_slide.cta_reasoning) {
    lines.push("");
    lines.push(`_Why: ${b.final_slide.cta_reasoning}_`);
  }
  if (b.design_notes) {
    lines.push("");
    lines.push(`---`);
    lines.push(`Design notes: ${b.design_notes}`);
  }
  if (b.loss_aversion_opportunity) {
    lines.push("");
    lines.push(`Loss-aversion opportunity: ${b.loss_aversion_opportunity}`);
  }
  return lines.join("\n");
}

function captionReelToText(b: CaptionReelBrief): string {
  // Variant detection mirrors the brief view's auto-migration logic so
  // legacy briefs (no `variant` field) still export correctly.
  const raw = b as unknown as Record<string, unknown>;
  const variant =
    typeof raw.variant === "string"
      ? raw.variant
      : Array.isArray(raw.text_cards)
        ? "sequential_cards"
        : typeof raw.wall_text === "string"
          ? "wall"
          : null;
  if (variant === "sequential_cards") {
    return captionReelSequentialToText(
      b as import("./types").CaptionReelSequentialBrief,
    );
  }
  if (variant === "wall") {
    return captionReelWallToText(b as import("./types").CaptionReelWallBrief);
  }
  return `# Caption Reel\n\n(Brief is in an unrecognised shape. Regenerate it.)`;
}

function captionReelWallToText(
  b: import("./types").CaptionReelWallBrief,
): string {
  const lines: string[] = [];
  lines.push(`# Caption Reel — Wall of text loop`);
  lines.push("");

  if (!b.claimable_observation_found) {
    lines.push("(no wall — script lacks a claimable observation)");
    if (b.claimable_observation_explanation) {
      lines.push("");
      lines.push(b.claimable_observation_explanation);
    }
    return lines.join("\n");
  }

  lines.push(
    `## Wall (${b.word_count} words, ~${b.estimated_read_time_seconds.toFixed(1)}s to read)`,
  );
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

function captionReelSequentialToText(
  b: import("./types").CaptionReelSequentialBrief,
): string {
  const lines: string[] = [];
  const total = b.text_cards.reduce((s, c) => s + (c.duration_seconds || 0), 0);
  lines.push(
    `# Caption Reel — Sequential cards (${b.text_cards.length} cards, ~${total.toFixed(1)}s)`,
  );
  lines.push("");
  if (b.music_recommendation) {
    lines.push(`Music: ${b.music_recommendation}`);
    lines.push("");
  }
  for (const c of b.text_cards) {
    lines.push(`## Card ${c.card_number} (${c.duration_seconds.toFixed(1)}s)`);
    lines.push(`Text: ${c.text}`);
    if (c.broll_suggestion) {
      lines.push(`B-roll: ${c.broll_suggestion}`);
    }
    lines.push("");
  }
  if (b.production_notes) {
    lines.push(`---`);
    lines.push(`Production notes: ${b.production_notes}`);
  }
  return lines.join("\n");
}

function voiceoverToText(b: VoiceoverBrief, register: string): string {
  const variant = (b as { variant?: string }).variant;
  if (variant !== "interview_cut" && variant !== "friend_vo") {
    return `# Voiceover with B-Roll — ${register}\n\n(Legacy brief in outdated format. Regenerate to get the current artifact.)`;
  }
  if (b.variant === "interview_cut") {
    return interviewCutToText(b);
  }
  return friendVOToText(b);
}

function interviewCutToText(b: import("./types").InterviewCutBrief): string {
  const lines: string[] = [];
  lines.push(`# Interview Cut Reel`);
  lines.push("");
  if (b.format_fit_assessment) {
    lines.push(`Format fit: ${b.format_fit_assessment}`);
    lines.push("");
  }
  lines.push(
    `## Cutting plan (${b.selected_sentences.length} sentences, ~${b.estimated_total_duration_seconds.toFixed(1)}s)`,
  );
  for (const s of b.selected_sentences) {
    lines.push(`${s.sentence_number}. ${s.talking_head_sentence}`);
    if (s.edit_notes) {
      lines.push(`   ${s.edit_notes}${s.estimated_duration_seconds ? ` · ~${s.estimated_duration_seconds.toFixed(1)}s` : ""}`);
    }
  }
  if (b.text_overlay_phrases.length > 0) {
    lines.push("");
    lines.push(`## Text overlays`);
    for (const p of b.text_overlay_phrases) lines.push(`- "${p}"`);
  }
  if (b.talking_head_cutbacks.length > 0) {
    lines.push("");
    lines.push(`## Talking-head cutbacks`);
    for (const c of b.talking_head_cutbacks) {
      lines.push(`[${c.timestamp}] ${c.purpose}`);
    }
  }
  if (b.broll_timeline.length > 0) {
    lines.push("");
    lines.push(`## B-roll timeline`);
    for (const e of b.broll_timeline) {
      lines.push(
        `[${e.timestamp_start}–${e.timestamp_end}] ${e.broll_description} — ${e.purpose}`,
      );
    }
  }
  if (b.sentences_cut.length > 0) {
    lines.push("");
    lines.push(`## Sentences cut`);
    for (const s of b.sentences_cut) lines.push(`- ${s}`);
  }
  if (b.production_notes) {
    lines.push("");
    lines.push(`Production notes: ${b.production_notes}`);
  }
  return lines.join("\n");
}

function friendVOToText(b: import("./types").FriendVOBrief): string {
  const lines: string[] = [];
  lines.push(`# Re-Recorded Friend VO`);
  lines.push("");
  if (b.friend_material_assessment) {
    lines.push(`Friend material: ${b.friend_material_assessment}`);
    lines.push("");
  }
  if (!b.audio_script.trim()) {
    lines.push(
      "(no script — talking head doesn't contain authentic Friend material)",
    );
    return lines.join("\n");
  }
  lines.push(
    `## Audio script (${b.word_count} words, ~${b.estimated_duration_seconds.toFixed(0)}s)`,
  );
  lines.push("");
  lines.push(b.audio_script);
  lines.push("");
  lines.push(`## Structural arc`);
  if (b.structural_arc.drop_in_opener) {
    lines.push(`- Drop-in opener: ${b.structural_arc.drop_in_opener}`);
  }
  if (b.structural_arc.escalation) {
    lines.push(`- Escalation: ${b.structural_arc.escalation}`);
  }
  if (b.structural_arc.vulnerability_beat) {
    lines.push(`- Vulnerability beat: ${b.structural_arc.vulnerability_beat}`);
  }
  if (b.structural_arc.reflection) {
    lines.push(`- Reflection: ${b.structural_arc.reflection}`);
  }
  if (b.structural_arc.implicit_invitation) {
    lines.push(
      `- Implicit invitation: ${b.structural_arc.implicit_invitation}`,
    );
  }
  if (b.broll_timeline.length > 0) {
    lines.push("");
    lines.push(`## B-roll timeline (atmospheric)`);
    for (const e of b.broll_timeline) {
      lines.push(
        `[${e.timestamp_start}–${e.timestamp_end}] ${e.broll_description} — ${e.purpose}`,
      );
    }
  }
  if (b.audio_treatment_notes) {
    lines.push("");
    lines.push(`Audio treatment: ${b.audio_treatment_notes}`);
  }
  if (b.comment_trigger) {
    lines.push(`Comment trigger: ${b.comment_trigger}`);
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
