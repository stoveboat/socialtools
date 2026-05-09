import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | undefined;

export function getAnthropicClient(): Anthropic {
  if (!cached) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return cached;
}

export const GRADING_MODEL = "claude-opus-4-7";
