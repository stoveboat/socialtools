import type { DimensionId } from "./types";

// Why each dimension matters — surfaced on the Repair Card to ground the user
// in *why* this fix is worth making.
export const DIMENSION_RATIONALE: Record<DimensionId, string> = {
  spine:
    "The spine is the one sentence the script exists to deliver. Without a clear spine, every other dimension drifts because there's no centre of gravity. A viewer who can't summarize the script in one line won't share it.",
  audience:
    "Specific audience signals are the fastest path to recognition: the right reader feels addressed, and everyone else self-selects out cleanly. Generic language flattens both.",
  tension:
    "Tension is the engagement engine — the curiosity gap, contradiction, or unresolved question that pulls the viewer forward. Without it, a script becomes informational background that the algorithm and the viewer both stop watching.",
  payoff:
    "The payoff is what the viewer walks away holding. A specific tactic, permission, reframe, or piece of language gets saved and shared; a vague \"that's interesting\" trails off and gets forgotten.",
  authority:
    "Authority is the speaker's standing on this topic. Specific terminology and concrete experience tell the viewer why to listen; hedging and vague phrasing tell the viewer the speaker isn't sure either.",
  hook: "The first 1-3 sentences earn the rest of the script's airtime. Conversational throat-clearing (\"So today I want to talk about...\") burns those seconds; a counterintuitive fact, vivid image, or direct claim spends them.",
  structure:
    "A clear shape — Hook → Value → Payoff, Story → Empathy → Advice, etc. — gives the viewer a sense of progression. Meandering scripts or competing closings fight each other for the final position and dilute both.",
  specificity:
    "Concrete nouns, named tools, specific numbers, and vivid sensory details give the script texture. Vague language (\"things,\" \"stuff,\" \"various\") flattens the texture and signals the speaker hasn't pinned down what they mean.",
  compression:
    "Tight scripts deliver value per word. Padding (\"basically what I want to say is...\") and redundant restatements dilute every sentence and make the viewer wait for content.",
  voice:
    "A consistent voice means the script sounds like one person from start to finish. Voice breaks (a sentence that reads like a different writer) snap the viewer out of the experience and signal that the script was edited rather than written.",
  off_positioning:
    "Off-positioning means the script's topic or voice doesn't fit what the channel exists to do. A viewer who arrives expecting one thing and gets another stops engaging — and the algorithm follows their behaviour.",
};
