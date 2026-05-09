import "server-only";
import OpenAI from "openai";

let cached: OpenAI | undefined;

export function getLLMClient(): OpenAI {
  if (!cached) {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY is not set");
    }
    cached = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });
  }
  return cached;
}

// deepseek-chat (V3): faster, cheaper, returns clean JSON.
// deepseek-reasoner (R1): slower with explicit chain-of-thought; better at hard
// reasoning but harder to coerce into strict JSON. Default to chat for grading.
export const GRADING_MODEL = "deepseek-chat";
