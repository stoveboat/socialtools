import { getLLMClient, GRADING_MODEL } from "../llm";
import {
  ENGAGEMENT_SYSTEM_PROMPT,
  ENGAGEMENT_USER_PROMPT,
  FOUNDATION_REBUILD_USER_PROMPT,
  FOUNDATION_REVISE_USER_PROMPT,
  FOUNDATION_SCRATCH_USER_PROMPT,
  FOUNDATION_SYSTEM_PROMPT,
  SALVAGEABLE_SEEDS_SYSTEM_PROMPT,
  SALVAGEABLE_SEEDS_USER_PROMPT,
  SPINE_CANDIDATES_SYSTEM_PROMPT,
  SPINE_CANDIDATES_USER_PROMPT,
  SURFACE_SYSTEM_PROMPT,
  SURFACE_USER_PROMPT,
  fillTemplate,
} from "./prompts";
import type { ChannelContext } from "./types";

class JsonError extends Error {}

async function callJson(
  system: string,
  user: string,
  temperature: number,
): Promise<unknown> {
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
    throw new JsonError("Empty response from model");
  }
  try {
    return JSON.parse(content);
  } catch {
    throw new JsonError("Response was not valid JSON");
  }
}

async function callJsonWithRetry(
  system: string,
  user: string,
  firstTemp = 0.4,
  retryTemp = 0.6,
): Promise<unknown> {
  try {
    return await callJson(system, user, firstTemp);
  } catch {
    return await callJson(system, user, retryTemp);
  }
}

// ============================================================================
// Spine candidates (Foundation pass, "revise" mode)
// ============================================================================

export interface SpineCandidate {
  spine: string;
  rationale: string;
  type: "drawn_from_script" | "sharpened";
}

export async function generateSpineCandidates(
  script: string,
  context: ChannelContext,
): Promise<SpineCandidate[]> {
  const userPrompt = fillTemplate(SPINE_CANDIDATES_USER_PROMPT, {
    script,
    audience: context.audience,
    channel: context.channel,
    topic_summary: context.topic_summary,
  });
  const parsed = (await callJsonWithRetry(
    SPINE_CANDIDATES_SYSTEM_PROMPT,
    userPrompt,
  )) as { candidates?: unknown };
  if (!Array.isArray(parsed.candidates)) {
    throw new Error("spine_candidates: missing candidates array");
  }
  const out: SpineCandidate[] = [];
  for (const c of parsed.candidates as Record<string, unknown>[]) {
    if (
      typeof c.spine === "string" &&
      typeof c.rationale === "string" &&
      (c.type === "drawn_from_script" || c.type === "sharpened")
    ) {
      out.push({
        spine: c.spine,
        rationale: c.rationale,
        type: c.type,
      });
    }
  }
  if (out.length === 0) {
    throw new Error("spine_candidates: no valid candidates returned");
  }
  return out;
}

// ============================================================================
// Salvageable seeds (Foundation pass, "rebuild" mode)
// ============================================================================

export interface SalvageableSeed {
  fragment: string;
  type:
    | "concrete_image"
    | "contrarian_claim"
    | "personal_experience"
    | "specific_fact";
  rationale: string;
}

const VALID_SEED_TYPES = new Set([
  "concrete_image",
  "contrarian_claim",
  "personal_experience",
  "specific_fact",
]);

export async function generateSalvageableSeeds(
  script: string,
  context: ChannelContext,
): Promise<SalvageableSeed[]> {
  const userPrompt = fillTemplate(SALVAGEABLE_SEEDS_USER_PROMPT, {
    script,
    audience: context.audience,
    channel: context.channel,
    topic_summary: context.topic_summary,
  });
  const parsed = (await callJsonWithRetry(
    SALVAGEABLE_SEEDS_SYSTEM_PROMPT,
    userPrompt,
  )) as { seeds?: unknown };
  if (!Array.isArray(parsed.seeds)) {
    throw new Error("salvageable_seeds: missing seeds array");
  }
  const out: SalvageableSeed[] = [];
  for (const s of parsed.seeds as Record<string, unknown>[]) {
    if (
      typeof s.fragment === "string" &&
      typeof s.rationale === "string" &&
      typeof s.type === "string" &&
      VALID_SEED_TYPES.has(s.type)
    ) {
      out.push({
        fragment: s.fragment,
        type: s.type as SalvageableSeed["type"],
        rationale: s.rationale,
      });
    }
  }
  return out; // empty array is allowed — script may have no salvageable seeds
}

// ============================================================================
// Pass revisions
// ============================================================================

export interface RevisionResult {
  revised_script: string;
  what_changed: string;
  carries_forward?: string[];
}

function validateRevision(parsed: unknown): RevisionResult {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("revision: not an object");
  }
  const o = parsed as Record<string, unknown>;
  if (typeof o.revised_script !== "string" || o.revised_script.trim() === "") {
    throw new Error("revision: revised_script missing or empty");
  }
  if (typeof o.what_changed !== "string") {
    throw new Error("revision: what_changed missing");
  }
  return {
    revised_script: o.revised_script,
    what_changed: o.what_changed,
    carries_forward: Array.isArray(o.carries_forward)
      ? (o.carries_forward.filter((s) => typeof s === "string") as string[])
      : undefined,
  };
}

export type FoundationMode = "revise" | "rebuild" | "scratch";

export interface FoundationParams {
  mode: FoundationMode;
  spine: string;
  audience: string;
  payoff_type: string; // human-readable label, e.g. "Reframe"
  channel: string;
  topic_summary: string;
  script: string;
  feedback?: string;
  // rebuild only:
  seed_fragment?: string;
  seed_type?: string;
}

export async function runFoundationPass(
  p: FoundationParams,
): Promise<RevisionResult> {
  const template =
    p.mode === "rebuild"
      ? FOUNDATION_REBUILD_USER_PROMPT
      : p.mode === "scratch"
        ? FOUNDATION_SCRATCH_USER_PROMPT
        : FOUNDATION_REVISE_USER_PROMPT;

  const userPrompt = fillTemplate(template, {
    spine: p.spine,
    audience: p.audience,
    payoff_type: p.payoff_type,
    channel: p.channel,
    topic_summary: p.topic_summary,
    script: p.script,
    feedback: p.feedback ?? "",
    seed_fragment: p.seed_fragment ?? "",
    seed_type: p.seed_type ?? "",
  });

  const parsed = await callJsonWithRetry(
    FOUNDATION_SYSTEM_PROMPT,
    userPrompt,
  );
  return validateRevision(parsed);
}

export interface EngagementParams {
  engagement_engine: string;
  structural_shape: string;
  audience: string;
  channel: string;
  script: string;
  feedback?: string;
}

export async function runEngagementPass(
  p: EngagementParams,
): Promise<RevisionResult> {
  const userPrompt = fillTemplate(ENGAGEMENT_USER_PROMPT, {
    engagement_engine: p.engagement_engine,
    structural_shape: p.structural_shape,
    audience: p.audience,
    channel: p.channel,
    script: p.script,
    feedback: p.feedback ?? "",
  });
  const parsed = await callJsonWithRetry(
    ENGAGEMENT_SYSTEM_PROMPT,
    userPrompt,
  );
  return validateRevision(parsed);
}

export interface SurfaceParams {
  audience: string;
  channel: string;
  script: string;
  feedback?: string;
}

export async function runSurfacePass(
  p: SurfaceParams,
): Promise<RevisionResult> {
  const userPrompt = fillTemplate(SURFACE_USER_PROMPT, {
    audience: p.audience,
    channel: p.channel,
    script: p.script,
    feedback: p.feedback ?? "",
  });
  const parsed = await callJsonWithRetry(SURFACE_SYSTEM_PROMPT, userPrompt);
  return validateRevision(parsed);
}
