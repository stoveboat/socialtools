import { getLLMClient, GRADING_MODEL } from "../llm";
import {
  FIX_CANDIDATES_SYSTEM_PROMPT,
  FIX_CANDIDATES_USER_PROMPT,
  fillTemplate,
} from "./prompts";
import type { ChannelContext, DimensionGrade } from "./types";

export interface FixCandidate {
  description: string;
  original_sentences: string[];
  replacement_sentences: string[];
}

class CandidateValidationError extends Error {}

function validateCandidates(raw: string): FixCandidate[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CandidateValidationError("Not valid JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new CandidateValidationError("Response is not an object");
  }
  const obj = parsed as Record<string, unknown>;
  const list = obj.candidates;
  if (!Array.isArray(list) || list.length === 0) {
    throw new CandidateValidationError(
      "candidates must be a non-empty array",
    );
  }
  const out: FixCandidate[] = [];
  for (const c of list as Record<string, unknown>[]) {
    if (
      typeof c.description !== "string" ||
      !Array.isArray(c.original_sentences) ||
      !Array.isArray(c.replacement_sentences) ||
      !c.original_sentences.every((s) => typeof s === "string") ||
      !c.replacement_sentences.every((s) => typeof s === "string")
    ) {
      throw new CandidateValidationError("Candidate entry malformed");
    }
    if (c.original_sentences.length === 0) {
      throw new CandidateValidationError(
        "original_sentences must not be empty",
      );
    }
    out.push({
      description: c.description,
      original_sentences: c.original_sentences as string[],
      replacement_sentences: c.replacement_sentences as string[],
    });
  }
  return out;
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

export async function generateFixCandidates(
  grade: DimensionGrade,
  script: string,
  context: ChannelContext,
): Promise<FixCandidate[]> {
  const userPrompt = fillTemplate(FIX_CANDIDATES_USER_PROMPT, {
    dimension_name: grade.dimension_name,
    grade: grade.grade,
    evidence: grade.evidence,
    repair_suggestion: grade.repair_suggestion,
    audience: context.audience,
    channel: context.channel,
    topic_summary: context.topic_summary,
    script,
  });
  try {
    return validateCandidates(
      await callOnce(FIX_CANDIDATES_SYSTEM_PROMPT, userPrompt, 0.4),
    );
  } catch {
    return validateCandidates(
      await callOnce(FIX_CANDIDATES_SYSTEM_PROMPT, userPrompt, 0.6),
    );
  }
}

// ============================================================================
// Edit application — converts accepted repair_choices into a refined script
// by string-replacing each choice's original_sentences with its replacement.
// ============================================================================

export interface AppliedEdit {
  dimension_id: string;
  original: string;
  replacement: string;
  applied: boolean;
  reason?: string;
}

export interface RepairChoiceForApply {
  dimension_id: string;
  status: string;
  original_sentences: string[] | null;
  replacement_sentences: string[] | null;
  user_edited_replacement: string | null;
}

function joinSentences(parts: string[]): string {
  return parts.join(" ").trim();
}

export function applyAcceptedEdits(
  source: string,
  choices: RepairChoiceForApply[],
): { refined: string; edits: AppliedEdit[] } {
  let working = source;
  const edits: AppliedEdit[] = [];

  for (const c of choices) {
    if (c.status !== "accepted" && c.status !== "edited") continue;
    if (!c.original_sentences || c.original_sentences.length === 0) continue;

    const original = joinSentences(c.original_sentences);
    const replacement =
      c.status === "edited" && c.user_edited_replacement
        ? c.user_edited_replacement
        : joinSentences(c.replacement_sentences ?? []);

    const idx = working.indexOf(original);
    if (idx === -1) {
      // Fallback: try matching the first sentence only — model may have
      // joined sentences differently than the source uses.
      const firstSentence = c.original_sentences[0];
      const altIdx = working.indexOf(firstSentence);
      if (altIdx === -1) {
        edits.push({
          dimension_id: c.dimension_id,
          original,
          replacement,
          applied: false,
          reason: "original sentence(s) not found in current script",
        });
        continue;
      }
      working =
        working.slice(0, altIdx) +
        replacement +
        working.slice(altIdx + firstSentence.length);
    } else {
      working =
        working.slice(0, idx) +
        replacement +
        working.slice(idx + original.length);
    }
    edits.push({
      dimension_id: c.dimension_id,
      original,
      replacement,
      applied: true,
    });
  }

  return { refined: working, edits };
}
