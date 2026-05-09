import { getLLMClient, GRADING_MODEL } from "../llm";
import {
  GRADING_SYSTEM_PROMPT,
  PHASE_0_SYSTEM_PROMPT,
  PHASE_0_USER_PROMPT,
  fillTemplate,
  type DimensionPrompt,
} from "./prompts";
import type {
  ChannelContext,
  DimensionGrade,
  Grade,
  Phase0Inference,
} from "./types";

class JsonValidationError extends Error {
  constructor(message: string, readonly raw: string) {
    super(message);
  }
}

const VALID_GRADES: ReadonlySet<Grade> = new Set(["A", "B", "C", "D", "F"]);

function parseDimensionResponse(raw: string): {
  grade: Grade;
  evidence: string;
  repair_suggestion: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new JsonValidationError("Response is not valid JSON", raw);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new JsonValidationError("Response is not a JSON object", raw);
  }
  const obj = parsed as Record<string, unknown>;

  if (typeof obj.grade !== "string" || !VALID_GRADES.has(obj.grade as Grade)) {
    throw new JsonValidationError(
      `Missing or invalid grade (got ${JSON.stringify(obj.grade)})`,
      raw,
    );
  }
  if (typeof obj.evidence !== "string" || obj.evidence.trim() === "") {
    throw new JsonValidationError("Missing or empty evidence", raw);
  }
  // repair_suggestion may be missing for grade A; coerce to empty string.
  const repair =
    typeof obj.repair_suggestion === "string" ? obj.repair_suggestion : "";

  return {
    grade: obj.grade as Grade,
    evidence: obj.evidence,
    repair_suggestion: repair,
  };
}

function parsePhase0Response(raw: string): Phase0Inference {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new JsonValidationError("Phase 0 response is not valid JSON", raw);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new JsonValidationError("Phase 0 response is not an object", raw);
  }
  const obj = parsed as Record<string, unknown>;

  if (typeof obj.topic_summary !== "string") {
    throw new JsonValidationError("Phase 0: missing topic_summary", raw);
  }
  if (
    !Array.isArray(obj.audience_candidates) ||
    !obj.audience_candidates.every((s) => typeof s === "string")
  ) {
    throw new JsonValidationError(
      "Phase 0: audience_candidates must be a string array",
      raw,
    );
  }
  if (
    !Array.isArray(obj.channel_candidates) ||
    !obj.channel_candidates.every((s) => typeof s === "string")
  ) {
    throw new JsonValidationError(
      "Phase 0: channel_candidates must be a string array",
      raw,
    );
  }

  return {
    topic_summary: obj.topic_summary,
    audience_candidates: obj.audience_candidates as string[],
    channel_candidates: obj.channel_candidates as string[],
    is_low_confidence: obj.is_low_confidence === true,
    evidence_notes:
      typeof obj.evidence_notes === "string" ? obj.evidence_notes : "",
  };
}

async function callJson(
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
): Promise<string> {
  const client = getLLMClient();
  const response = await client.chat.completions.create({
    model: GRADING_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
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

async function callWithRetry<T>(
  systemPrompt: string,
  userPrompt: string,
  parse: (raw: string) => T,
): Promise<T> {
  try {
    const raw = await callJson(systemPrompt, userPrompt, 0.0);
    return parse(raw);
  } catch (firstError) {
    // One retry at slightly higher temperature, per the design doc.
    const raw = await callJson(systemPrompt, userPrompt, 0.2);
    try {
      return parse(raw);
    } catch (secondError) {
      const firstMsg =
        firstError instanceof Error ? firstError.message : String(firstError);
      const secondMsg =
        secondError instanceof Error
          ? secondError.message
          : String(secondError);
      throw new Error(
        `Both attempts failed. First: ${firstMsg}. Second: ${secondMsg}`,
      );
    }
  }
}

export async function gradeDimension(
  prompt: DimensionPrompt,
  vars: Record<string, string>,
): Promise<DimensionGrade> {
  const userPrompt = fillTemplate(prompt.user_prompt, vars);
  const result = await callWithRetry(
    GRADING_SYSTEM_PROMPT,
    userPrompt,
    parseDimensionResponse,
  );
  return {
    dimension_id: prompt.id,
    dimension_name: prompt.name,
    grade: result.grade,
    evidence: result.evidence,
    repair_suggestion: result.repair_suggestion,
  };
}

export async function runPhase0(script: string): Promise<Phase0Inference> {
  const userPrompt = fillTemplate(PHASE_0_USER_PROMPT, { script });
  return callWithRetry(
    PHASE_0_SYSTEM_PROMPT,
    userPrompt,
    parsePhase0Response,
  );
}

export function buildContext(
  phase0: Phase0Inference,
  overrides: Partial<ChannelContext>,
): ChannelContext {
  return {
    audience: overrides.audience || phase0.audience_candidates[0] || "Unknown",
    channel: overrides.channel || phase0.channel_candidates[0] || "Unknown",
    traction: overrides.traction || "Unknown",
    topic_summary: phase0.topic_summary,
  };
}
