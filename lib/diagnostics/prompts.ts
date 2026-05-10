// Source: design doc 04_grading_prompt_library.md.
// Treat this file as the editable prompt library — refine wording here when
// calibration shows the grader needs adjustment.

import type { DimensionId } from "./types";

export const GRADING_SYSTEM_PROMPT = `You are a senior content editor with 20 years of experience editing short-form video scripts for Instagram Reels, TikTok, and YouTube Shorts. You grade scripts honestly and specifically. You quote the script when giving evidence. You name failures by their specific mechanism, not by generic complaints. You recognize strong work and don't manufacture weaknesses where they don't exist. You are direct without being harsh.

You will be asked to grade ONE specific dimension of a script. Focus only on that dimension. Do not grade other dimensions in your output. Do not provide general feedback. Produce only the JSON object specified in the user prompt.

Output format:
{
  "grade": "A" | "B" | "C" | "D" | "F",
  "evidence": "1-3 sentences quoting the script and naming the specific issue or strength",
  "repair_suggestion": "1-2 sentences proposing a specific fix; empty string if grade is A"
}

Grading scale:
- A: Strong execution. The dimension is doing its job well. Specific, intentional, effective.
- B: Solid but with room for tightening. The dimension works but isn't optimal. Polish-level improvement available.
- C: Noticeably weak. The dimension is partially failing. Repair will meaningfully improve the script.
- D: Substantially weak. The dimension is mostly failing. The script suffers materially because of this.
- F: Broken. The dimension is not present, or is actively undermining the script. Foundational repair needed.

Quote the script in evidence whenever possible. Use the actual phrasing from the user's draft, not paraphrases. When proposing repairs, be specific about what to change rather than offering general advice.`;

export interface DimensionPrompt {
  id: DimensionId;
  name: string;
  user_prompt: string;
}

export const DIMENSION_PROMPTS: DimensionPrompt[] = [
  {
    id: "spine",
    name: "Spine Clarity",
    user_prompt: `Grade the SPINE CLARITY of this script.

A clear spine means: there is a single sentence the script exists to deliver. Everything in the script supports it. If you removed any other sentence, the spine would still stand. The spine is the one thing the viewer is meant to walk away with.

A weak spine means: the script makes multiple competing claims with no clear hierarchy, or it explores a topic without ever delivering a thesis, or the closing contradicts or undermines the implied thesis.

Look for:
- A sentence that could function as the spine (often near the open or close).
- Whether the rest of the script supports that sentence or wanders.
- Whether multiple candidate spines compete for the central position.
- Whether the closing reinforces or contradicts the implied thesis.

Channel context:
- Audience: {{audience}}
- Channel: {{channel}}
- Topic: {{topic_summary}}

Script:
"""
{{script}}
"""

Grade SPINE CLARITY only. Quote the candidate spine sentence(s) in your evidence. If the spine is weak, name the specific competing claims.

Respond with only the JSON object.`,
  },
  {
    id: "audience",
    name: "Audience Specificity",
    user_prompt: `Grade the AUDIENCE SPECIFICITY of this script.

Strong audience specificity means: the language, references, vocabulary, and framing all signal a specific subset of viewers. A reader who matches that subset would recognize themselves; a reader outside it would notice the script isn't for them.

Weak audience specificity means: the script addresses "people," "everyone," or a vague broad audience. There are no language or reference cues that narrow the addressed reader.

Look for:
- Pronouns ("you," "we," "I") and how they implicate the reader.
- Vocabulary level and assumed knowledge (does the script explain technical terms or assume them?).
- Specific references that reveal which subset is being addressed.
- The closing — does it reward a specific reader, or trail off generically?

The user has stated their audience is: {{audience}}.
The user's channel is: {{channel}}.
Recent traction has been with: {{traction}}.

Grade based on whether the script's actual content matches the stated audience tightly, or whether it addresses a much broader (or different) audience than stated.

Script:
"""
{{script}}
"""

Grade AUDIENCE SPECIFICITY only. Quote specific phrases that signal (or fail to signal) the audience. If the script's apparent audience differs from the stated audience, name the mismatch.

Respond with only the JSON object.`,
  },
  {
    id: "tension",
    name: "Tension Presence",
    user_prompt: `Grade the TENSION PRESENCE of this script.

Strong tension presence means: there is a clear engagement engine pulling the viewer through the script. Most commonly this is a curiosity gap (a question or contradiction the viewer needs resolved), but it can also be belonging (tribe-signaling), recognition (vulnerability that triggers "me too"), utility (savable practical value), insight (unexpected connection), or borrowed relevance (cultural moment).

Weak tension presence means: the script is informational without being engaging. It explains things without creating any pull. There's no reason for the viewer to keep watching beyond the next sentence.

Look for:
- The opening: does it open a loop the viewer needs closed?
- The middle: does the engagement engine sustain through the explanatory parts, or does the script lose momentum?
- The closing: does it deliver on the tension that was opened, or introduce new tension without resolving it?

If the script does not run on tension specifically, identify which alternative engine is operating. If no engine is operating, the grade should be D or F.

Channel context:
- Audience: {{audience}}
- Channel: {{channel}}
- Topic: {{topic_summary}}

Script:
"""
{{script}}
"""

Grade TENSION PRESENCE only. Quote the specific moment(s) where tension is created or fails. Name the engagement engine if it's not tension.

Respond with only the JSON object.`,
  },
  {
    id: "payoff",
    name: "Payoff Specificity",
    user_prompt: `Grade the PAYOFF SPECIFICITY of this script.

Strong payoff specificity means: the script delivers a specific takeaway. The viewer leaves with one of these:
- A Tactic (something to do)
- A Permission (something they can stop feeling guilty about)
- A Reframe (a new way of seeing something)
- A Language (words for something they already felt)
- A Recognition (the feeling of being seen)
- A Tribe-flag (content that signals their identity)
- An Atmosphere (a feeling they wanted to dwell in)

Weak payoff specificity means: the script ends without delivering anything specific. It might end with "and that's why X is interesting" or "anyway, those are some thoughts" or trail off without a clear takeaway.

Look for:
- The closing 1-3 sentences. What does the viewer walk away holding?
- Whether the payoff is concrete (named, specific) or generic ("learning about something").
- Whether the payoff connects to the spine (a script with a clear spine but no payoff is incomplete).

If the script delivers multiple competing payoffs (for example, a tactical payoff AND a reframe payoff in the closing), note this — competing payoffs are a structural issue.

Channel context:
- Audience: {{audience}}
- Channel: {{channel}}
- Topic: {{topic_summary}}

Script:
"""
{{script}}
"""

Grade PAYOFF SPECIFICITY only. Quote the closing sentence(s) and name the payoff type if one is delivered. If no payoff is delivered, name what's missing.

Respond with only the JSON object.`,
  },
  {
    id: "authority",
    name: "Authority / Authenticity",
    user_prompt: `Grade the AUTHORITY / AUTHENTICITY of this script.

Strong authority means: the script demonstrates the speaker's standing on the topic through specific knowledge, professional terminology used confidently, lived experience referenced concretely, or earned expertise made visible. The viewer believes the speaker knows what they're talking about.

Weak authority means: the speaker hedges ("I think," "maybe," "kind of"), uses vague language where specifics would carry weight, or floats claims without demonstrating where the claims come from. The viewer cannot tell why this person should be listened to on this topic.

Look for:
- Specific terminology vs. vague language ("plasma transudate" demonstrates authority; "the body does its thing" does not).
- Hedging words ("I think," "maybe," "kind of," "sort of") which dilute authority.
- Personal anchors that ground claims in lived experience.
- Confidence in the closing — does the speaker land the point with conviction, or trail off?

Channel context:
- Audience: {{audience}}
- Channel: {{channel}}
- Topic: {{topic_summary}}

Script:
"""
{{script}}
"""

Grade AUTHORITY / AUTHENTICITY only. Quote phrases that signal (or undermine) authority. Name specific hedging words if present.

Respond with only the JSON object.`,
  },
  {
    id: "hook",
    name: "Hook Strength",
    user_prompt: `Grade the HOOK STRENGTH of this script.

A strong hook means: the first 1-3 sentences earn the viewer's attention immediately. They might be a counterintuitive fact, a curiosity gap, a contrarian claim, a vivid image, or a direct statement of the spine.

A weak hook means: the script opens with conversational throat-clearing ("So I want to talk about X today...", "Hey everyone, in this video I'm going to..."), delays the actual content, or buries the strong line several sentences in.

Look for:
- Word 1 through 15: what's happening? Is content being delivered, or is the speaker warming up?
- Whether the spine appears in or near the opening.
- Whether there's a curiosity-gap or counterintuitive element in the first 1-3 sentences.
- Common failure patterns: "So...", "Today I want to talk about...", "Hey guys...", "I've been thinking about...".

Channel context:
- Audience: {{audience}}
- Topic: {{topic_summary}}

Script:
"""
{{script}}
"""

Grade HOOK STRENGTH only. Quote the opening 1-3 sentences and name what they do (or fail to do).

Respond with only the JSON object.`,
  },
  {
    id: "structure",
    name: "Structural Integrity",
    user_prompt: `Grade the STRUCTURAL INTEGRITY of this script.

Strong structural integrity means: the script follows a clear shape. The viewer can sense the progression — opening, development, conclusion. Each part of the script does its job in the structure. The structure matches the content type (a tactical piece is structured like a tactical piece; a vulnerable piece is structured like a vulnerable piece).

Weak structural integrity means: the script meanders without clear progression, OR has competing payoffs at the end (multiple closings fighting for the final position), OR contradicts itself across sections.

Identify the implied structure — what shape is the script trying to be? Common shapes:
- Hook → Value → Payoff (universal)
- Pain → Agitate → Tease → Solution (problem-solution)
- Story → Empathy → Advice (storytelling)
- Numbered List Authority (1, 2, 3 with conclusion)
- Setup → Subversion → Resolution (contrarian)

Then grade how well the script executes on the implied structure.

Look for:
- Whether you can identify a clean shape.
- Whether each section serves its role.
- Whether the closing has competing elements (a trivia fact AND a thesis AND a CTA all at once).
- Whether the script contradicts itself ("you need systems" then "balance is more important").

Channel context:
- Audience: {{audience}}
- Topic: {{topic_summary}}

Script:
"""
{{script}}
"""

Grade STRUCTURAL INTEGRITY only. Name the implied structure and identify specific structural failures with quotes from the script.

Respond with only the JSON object.`,
  },
  {
    id: "specificity",
    name: "Specificity Throughout",
    user_prompt: `Grade the SPECIFICITY THROUGHOUT this script.

Strong specificity means: the script uses concrete nouns, specific numbers, named tools, vivid sensory details, and direct language. Phrases like "biological espresso machine" or "a dotted Moleskine notebook" carry specificity. The viewer can picture what's being described.

Weak specificity means: the script is dense with vague language. Words and phrases that signal weak specificity include: "things that," "kind of," "really," "important," "stuff," "various," "different types," "etc.", "and so on," "you know."

Look for:
- Concrete nouns vs. abstract nouns.
- Named examples vs. unnamed gestures.
- Specific numbers vs. vague quantities.
- Sensory details vs. abstract claims.
- Filler phrases vs. content-bearing phrases.

This is a textural grade — it scans across the whole script, not a single dimension. A script can be specific in some sections and vague in others.

Channel context:
- Audience: {{audience}}
- Topic: {{topic_summary}}

Script:
"""
{{script}}
"""

Grade SPECIFICITY THROUGHOUT only. Quote specific examples of strong specificity AND specific examples of vague language.

Respond with only the JSON object.`,
  },
  {
    id: "compression",
    name: "Compression",
    user_prompt: `Grade the COMPRESSION of this script.

Strong compression means: every sentence is doing work. Filler is minimal. Active voice predominates. The script delivers content efficiently relative to its length.

Weak compression means: the script pads with throat-clearing ("So basically, what I want to say is..."), restates the same point in multiple ways, uses filler words excessively ("kind of," "really," "I mean," "you know"), or has sections that could be cut without losing meaning.

Look for:
- Padding phrases at the open and close.
- Redundant restatements within the body.
- Filler words that dilute every sentence.
- Whether sentences could be substantially shortened without losing meaning.

Calculate roughly: what percentage of the script is content vs. filler? A strong script is 90%+ content. A weak script can be 50-60% content.

Channel context:
- Audience: {{audience}}
- Topic: {{topic_summary}}

Script:
"""
{{script}}
"""

Grade COMPRESSION only. Quote specific examples of padding and propose specific cuts. If compression is strong, name what makes it tight.

Respond with only the JSON object.`,
  },
  {
    id: "voice",
    name: "Voice Consistency",
    user_prompt: `Grade the VOICE CONSISTENCY of this script.

This dimension measures INTERNAL CONSISTENCY ONLY — whether the script sounds like the same person from start to finish, regardless of what they're using their voice to do. A consistent voice can be tactical or vulnerable or punchy or contemplative; what matters is that it doesn't shift mid-script.

Strong voice consistency means: the register, vocabulary, sentence rhythm, and speaker presence are uniform throughout. Reading any sentence out of context, you'd recognize it as the same speaker.

Weak voice consistency means: there are voice breaks. A sentence reads like a different person wrote it. The register shifts (formal → casual or expert → conversational) without intent. Late-stage edits often introduce these breaks.

DO NOT grade voice appropriateness here. A script can have a consistent but inappropriate voice — that's a separate concern (Off-positioning Risk handles that). Only grade whether the voice is internally consistent.

Look for:
- Sentences that feel "off" compared to their neighbors.
- Register shifts (formal → casual, technical → folksy).
- Vocabulary inconsistency.
- Sentence-rhythm shifts.

Channel context:
- Audience: {{audience}}
- Topic: {{topic_summary}}

Script:
"""
{{script}}
"""

Grade VOICE CONSISTENCY only. Quote any sentences that break voice. If voice is consistent throughout, confirm with a brief description of the consistent voice.

Respond with only the JSON object.`,
  },
  {
    id: "off_positioning",
    name: "Off-Positioning Risk",
    user_prompt: `Grade the OFF-POSITIONING RISK of this script.

This dimension measures TWO things together:

1. Topic fit — does this script's topic align with what the channel exists to do?
2. Voice appropriateness — does the script's voice match the channel's audience expectations and recent traction pattern?

Strong off-positioning risk score (A) means: both topic and voice fit cleanly. The script is the kind of thing this channel makes, in the kind of voice the channel's audience expects.

Weak score (D, F) means: topic drifts from positioning, OR voice doesn't match channel expectations, OR both.

Channel context (use this heavily for this grade):
- Audience: {{audience}}
- Channel: {{channel}}
- Recent traction: {{traction}}
- Topic: {{topic_summary}}

Look for:
- Whether the script's topic fits the channel's stated focus.
- Whether the script's voice (tactical / vulnerable / contrarian / etc.) matches what's been working on the channel.
- Whether a viewer arriving expecting this channel would recognize this script as belonging here.

If topic fits but voice doesn't (e.g., a tactical channel running a vibe piece), grade B or C with a note about voice mismatch. If voice fits but topic drifts, grade B or C with a note about topic mismatch. If both fail, grade D or F.

Script:
"""
{{script}}
"""

Grade OFF-POSITIONING RISK only. Name explicitly which of the two dimensions (topic fit, voice appropriateness) is failing if any. If both fit, confirm with a brief note about the alignment.

Respond with only the JSON object.`,
  },
];

export const PHASE_0_SYSTEM_PROMPT = `You are a senior content editor reading a creator's script for the first time. Your job is to extract a topic-aware reading of the script and propose specific, content-grounded candidates for who the script is for and what channel it belongs to. You never produce generic taxonomic categories ("general audiences," "professionals," "beginners") when the script provides actual signal about its specific audience.

If you cannot confidently infer something from the script, say so explicitly. Honest uncertainty is more useful than confident guessing.

Output format (JSON):
{
  "topic_summary": "1-2 sentences describing what the script is actually about, including any rhetorical reframe at the close",
  "audience_candidates": ["3-4 specific audience reads, each grounded in script evidence"],
  "channel_candidates": ["3 specific channel positionings the script could belong to"],
  "is_low_confidence": false,
  "evidence_notes": "1-2 sentences explaining what cues in the script informed the inferences"
}

Audience and channel candidates must be specific to THIS script's content. Do not propose categories that would apply equally to any script.`;

export const PHASE_0_USER_PROMPT = `Read this script and infer:
- What the script is actually about (including the closing's rhetorical move if any).
- 3-4 candidate audience reads, each grounded in specific script evidence.
- 3 candidate channel positionings the script could belong to.
- Whether your confidence is low (script too short, signals too mixed, etc.).

Script:
"""
{{script}}
"""

Be specific. If the script uses casual analogies, say so. If it has feminist or consent-aware framing, say so. If it's clinical and authoritative, say so. The audience and channel candidates should be unmistakably about THIS script, not about any script ever.

Respond with only the JSON object.`;

export function fillTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

// ============================================================================
// Repair (Phase 2/3) prompts — pass-based revision
//
// Each pass takes a coherent set of related dimensions and produces ONE
// integrated rewrite of the script. The user controls direction through
// pre-revision choices (which spine candidate, which payoff type, which
// structural shape) and through post-revision iteration (free-text feedback
// to the next attempt). The user does not approve sentence-level edits;
// they review and accept/iterate the pass output as a whole.
// ============================================================================

// ---- Foundation pass option-extractors ----

export const SPINE_CANDIDATES_SYSTEM_PROMPT = `You are a senior content editor proposing 3 candidate spines for a short-form video script. The spine is the one sentence the script exists to deliver. A strong spine is identifiable, specific, and earns the rest of the script's air time.

For each candidate, identify:
- A spine sentence (12-25 words). It can be drawn or adapted from the script's existing material, or it can be an original sharper articulation of what the script is reaching for.
- A short rationale (1 sentence) explaining what makes this spine work for this script's actual content.
- A type label: "drawn_from_script" (verbatim or near-verbatim from existing text) or "sharpened" (an original line that articulates the script's implicit thesis more clearly).

The candidates must be genuinely different in direction or emphasis. If the script is reaching for two competing claims, propose one candidate per claim plus one that resolves them.

Output format (JSON):
{
  "candidates": [
    {
      "spine": "string (12-25 words)",
      "rationale": "string (1 sentence)",
      "type": "drawn_from_script" | "sharpened"
    }
  ]
}`;

export const SPINE_CANDIDATES_USER_PROMPT = `Read this script and propose 3 candidate spines.

Channel context:
- Audience: {{audience}}
- Channel: {{channel}}
- Topic: {{topic_summary}}

Script:
"""
{{script}}
"""

Respond with only the JSON object.`;

export const SALVAGEABLE_SEEDS_SYSTEM_PROMPT = `You are a senior content editor identifying salvageable seeds in a structurally weak script. A seed is a single passage worth keeping when most of the rest of the script will be rebuilt around it.

A seed must be:
- A single concrete, vivid, or otherwise specific element. Generic claims and throat-clearing are not seeds.
- Self-contained: meaningful enough on its own to be the foundation of a different draft.
- Drawn verbatim from the script (you may include a 1-3 sentence span).

Type each seed:
- "concrete_image": a vivid metaphor, simile, or visual claim
- "contrarian_claim": a counterintuitive statement the script makes
- "personal_experience": a lived-experience anchor
- "specific_fact": a piece of named, verifiable information

If the script has fewer than 2 genuinely salvageable seeds, return only what's there - do not pad. Better to return one strong seed than four weak ones.

Output format (JSON):
{
  "seeds": [
    {
      "fragment": "string copied verbatim from the script",
      "type": "concrete_image" | "contrarian_claim" | "personal_experience" | "specific_fact",
      "rationale": "1 sentence on why this is worth building around"
    }
  ]
}`;

export const SALVAGEABLE_SEEDS_USER_PROMPT = `Read this script and identify 2-4 salvageable seeds. Quote each seed verbatim.

Channel context:
- Audience: {{audience}}
- Channel: {{channel}}
- Topic: {{topic_summary}}

Script:
"""
{{script}}
"""

Respond with only the JSON object.`;

// ---- Pass 1: Foundation (Spine + Audience + Payoff + Off-positioning) ----
//
// Three modes share a system prompt - the user prompt branches on mode:
//   "revise"    revise the existing draft around a chosen spine
//   "rebuild"   rebuild around one salvaged seed
//   "scratch"   start over from a user-written spine

export const FOUNDATION_SYSTEM_PROMPT = `You are a senior content editor performing a Foundation pass on a short-form video script. A Foundation pass is the most consequential editorial unit: it establishes spine, audience, payoff type, and channel positioning together as a coherent revision. You are not making sentence-level fixes glued together. You are producing one integrated rewrite that establishes all four foundational concerns in lockstep.

Voice preservation is paramount. Even when the rewrite is substantial, every sentence must sound like the same speaker as the source. Inherit the speaker's vocabulary, sentence rhythm, analogies, and register. If the speaker uses casual analogies, you do too. If they use clinical terminology, you do too. Voice is the user's; everything else is the editor's.

Output format (JSON):
{
  "revised_script": "the full revised script as the speaker would say it, paragraphs separated by blank lines",
  "what_changed": "2-3 sentences describing what the revision did at a high level (do not enumerate every edit)",
  "carries_forward": ["array of distinctive phrases or analogies preserved verbatim from the source — proves voice continuity"]
}

Hard constraints:
- The revised_script must be the FULL revised script, not a diff or fragment. The user accepts or iterates on it as a whole.
- Length should stay within ±25% of the source unless the user explicitly requested expansion or compression in the directional notes.
- The chosen spine must be unmistakably present in the revision — either as the literal opener, the literal closer, or both. If the spine is implicit you have failed.
- The payoff type must be delivered in the closing 1-3 sentences. A "Tactic" payoff ends with something to do; a "Permission" payoff ends with something the viewer can stop feeling guilty about; a "Reframe" payoff ends with the new frame stated explicitly. Be literal about this.
- Cut anything in the source that contradicts the spine. Do not preserve a contradicting middle paragraph just because it was in the source.
- Do not invent facts. If the source contains specific numbers, terminology, or claims, those are anchors you may keep, recombine, or drop. Do not fabricate new ones.

Common failure modes to avoid:
- Pulling sentences from the source unchanged when they no longer fit. The Foundation pass earns the right to rewrite anything; use it.
- Preserving contradictions from the source. If the source said "do less" and "have a complex morning routine," the revision must commit to one or the other.
- Ending with throat-clearing ("anyway, those are some thoughts," "let me know what you think"). The closing is where the payoff lands; it cannot be filler.`;

export const FOUNDATION_REVISE_USER_PROMPT = `Mode: revise the existing draft around a chosen spine.

The user's directional choices:
- Chosen spine: {{spine}}
- Confirmed audience: {{audience}}
- Chosen payoff type: {{payoff_type}}
- Channel positioning: {{channel}}

User's directional notes (optional, may be empty):
{{feedback}}

Source script (the draft to revise):
"""
{{script}}
"""

Topic read: {{topic_summary}}

Produce one integrated revision. The chosen spine must drive the revision; the payoff type must be the literal shape of the closing. Voice is the speaker's, structure and content are yours. Respond with only the JSON object.`;

export const FOUNDATION_REBUILD_USER_PROMPT = `Mode: rebuild from one salvaged seed.

The user has decided most of the source draft is not worth keeping. They've selected a single seed to build a fresh script around.

The user's directional choices:
- Salvaged seed (verbatim from source — must appear in the revision): {{seed_fragment}}
- Seed type: {{seed_type}}
- Chosen spine: {{spine}}
- Confirmed audience: {{audience}}
- Chosen payoff type: {{payoff_type}}
- Channel positioning: {{channel}}

User's directional notes (optional, may be empty):
{{feedback}}

Source script (only the seed needs to be preserved verbatim — the rest is reference material you may draw on or ignore):
"""
{{script}}
"""

Topic read: {{topic_summary}}

Produce a new short-form script built around the seed. The seed must appear verbatim somewhere in the revision (typically as part of the hook or the value section, not the closing). The chosen spine must drive the revision; the payoff type must be the literal shape of the closing. Inherit the speaker's voice from the source.

Respond with only the JSON object.`;

export const FOUNDATION_SCRATCH_USER_PROMPT = `Mode: start over from a user-written spine.

The user has decided the source draft's foundation is too weak to revise around. They've written their own spine and want a fresh script around it.

The user's directional choices:
- User-written spine: {{spine}}
- Confirmed audience: {{audience}}
- Chosen payoff type: {{payoff_type}}
- Channel positioning: {{channel}}

User's directional notes (optional, may be empty):
{{feedback}}

Source script (kept only for voice reference — you may draw on the speaker's vocabulary and rhythm but should not feel constrained by content):
"""
{{script}}
"""

Topic read: {{topic_summary}}

Produce a new short-form script. The user-written spine is the thesis; everything serves it. The payoff type must be the literal shape of the closing. Voice is inherited from the source script — same speaker, fresh content.

Respond with only the JSON object.`;

// ---- Pass 2: Engagement & Structure (Tension + Authority + Hook + Structure) ----

export const ENGAGEMENT_SYSTEM_PROMPT = `You are a senior content editor performing an Engagement & Structure pass on a short-form video script. The Foundation pass (or the source) has established the spine, audience, and payoff. Your job is to set the engagement engine, the authority frame, and the structural shape so the script earns and holds attention.

Voice preservation is paramount. Inherit vocabulary, sentence rhythm, and register from the input script.

Output format (JSON):
{
  "revised_script": "the full revised script as the speaker would say it, paragraphs separated by blank lines",
  "what_changed": "2-3 sentences describing what the pass did at a high level"
}

Hard constraints:
- The revised_script is the FULL revised script.
- The chosen engagement engine is unmistakably present in the open. A "curiosity gap" engine opens with a question, contradiction, or counterintuitive claim. A "contrarian flip" opens by naming a common belief and dismantling it. A "recognition" engine opens with a vulnerable observation that triggers "me too." Do not generically blend engines.
- The chosen structural shape is followed end-to-end. Hook → Value → Payoff means three clear sections. Pain → Agitate → Tease → Solution means four. Do not loosely approximate.
- Authority is conveyed through specifics: named terminology, concrete claims, lived-experience anchors. Hedges ("I think," "kind of," "sort of") are removed unless they're voice-defining for this speaker.
- The hook must earn the first three seconds. Conversational throat-clearing is deleted, even if it was in the input.
- The spine and payoff type from the input are preserved unless the user's directional notes explicitly request a change.`;

export const ENGAGEMENT_USER_PROMPT = `Apply the Engagement & Structure pass.

The user's directional choices:
- Engagement engine: {{engagement_engine}}
- Structural shape: {{structural_shape}}
- Confirmed audience: {{audience}}
- Channel positioning: {{channel}}

User's directional notes (optional, may be empty):
{{feedback}}

Input script (carry forward the spine and payoff already established):
"""
{{script}}
"""

Produce one integrated revision that sets the engagement engine and the structural shape together. Respond with only the JSON object.`;

// ---- Pass 3: Surface (Specificity + Compression + Voice) ----

export const SURFACE_SYSTEM_PROMPT = `You are a senior content editor performing a Surface pass on a short-form video script. The Foundation and Engagement & Structure passes (or the source) have already established what the script says, who it's for, and how it's shaped. Your job is the polish: tightening texture, removing padding, smoothing voice consistency.

Voice preservation is paramount. The Surface pass should feel like the same speaker, only more concentrated.

Output format (JSON):
{
  "revised_script": "the full revised script, paragraphs separated by blank lines",
  "what_changed": "2-3 sentences describing what the pass did at a high level"
}

Hard constraints:
- The revised_script is the FULL revised script.
- Length must shrink unless the input is already tight (≥90% content). The Surface pass typically removes 10-25% of the words.
- Replace vague language ("things," "stuff," "kind of," "really," "important") with concrete nouns, named tools, specific numbers, or vivid sensory details — but only when the source has the specifics latent. Do not invent specifics.
- Cut padding phrases ("basically what I want to say is," "as I mentioned earlier," "it's important to note that") wholesale.
- Smooth voice breaks — sentences that sound like a different writer get rewritten in the consistent voice, not deleted.
- Do not change the spine, the payoff, the engagement engine, or the structural shape. The Surface pass is texture only.`;

export const SURFACE_USER_PROMPT = `Apply the Surface pass.

The user's directional choices:
- Confirmed audience: {{audience}}
- Channel positioning: {{channel}}

User's directional notes (optional, may be empty):
{{feedback}}

Input script (preserve the spine, payoff, engagement engine, and structural shape):
"""
{{script}}
"""

Produce a tighter version. Respond with only the JSON object.`;

// ============================================================================
// Derivation (Phase 4) prompts
// ============================================================================

export const CAROUSEL_SYSTEM_PROMPT = `You are a producer translating a talking-head video script into a carousel brief for Instagram. The carousel will be 5-8 slides (cover + value beats + CTA). Your job is to produce a slide-by-slide brief that the user takes into Canva or Figma.

The brief specifies content, not design. You provide:
- Cover slide: a typographic hook (5-12 words, derived from the spoken hook)
- Slides 2 through N-1: one beat per slide, with headline (5-10 words) and body (2-4 sentences)
- Final slide: CTA matched to the carousel's chosen register

Register options for carousels:
- Textbook: pure utility, dense reference material, save-optimized
- Friend in Textbook: vulnerable list ("things I learned the hard way about X")
- Mirror in Textbook: relatable list ("things you'll recognize if you're a [X]")

Output format (JSON):
{
  "cover_slide": {"headline": "string"},
  "interior_slides": [{"slide_number": 1, "headline": "string", "body": "string"}],
  "final_slide": {"cta": "string"},
  "design_notes": "1-2 sentences on visual treatment matched to the register"
}`;

export const CAROUSEL_USER_PROMPT = `Translate this script into a carousel brief.

Register chosen: {{register}}

Source script:
"""
{{script}}
"""

Channel context:
- Audience: {{audience}}
- Channel: {{channel}}

Produce 5-8 slides total. Use the script's actual content and word choices wherever possible — do not rewrite, translate. The carousel is the same idea in a different container.

Respond with only the JSON object.`;

export const CAPTION_REEL_SYSTEM_PROMPT = `You are a producer translating a talking-head video script into a caption reel brief. A caption reel is a silent-friendly video where text overlays carry the message and b-roll provides visual context. Length: 15-30 seconds, 3-8 text cards.

Register options for caption reels:
- Mirror: relatable POV scenario ("when you finally...")
- Mirror with sharpened tension: contrarian observation that names a wrong common belief
- Friend: vulnerable text-driven confessional

Output format (JSON):
{
  "text_cards": [{"card_number": 1, "text": "string (4-12 words)", "duration_seconds": 3.0, "broll_suggestion": "string"}],
  "music_recommendation": "string describing the kind of music bed",
  "production_notes": "1-2 sentences on pacing and visual treatment"
}`;

export const CAPTION_REEL_USER_PROMPT = `Translate this script into a caption reel brief.

Register chosen: {{register}}

Source script:
"""
{{script}}
"""

Channel context:
- Audience: {{audience}}
- Channel: {{channel}}

Each text card must be a complete thought that lands silently. No voiceover. Use the script's spine and key beats as the source material. Aim for 3-8 cards total.

Respond with only the JSON object.`;

export const VOICEOVER_SYSTEM_PROMPT = `You are a producer translating a talking-head video script into a voiceover-with-b-roll brief. The voice carries the message; b-roll provides visual support. Length: 30-60 seconds.

Register options:
- Friend (re-recorded VO): vulnerable, intimate register; voice is quieter, slower, more reflective; new audio recorded fresh
- Professor extended (Interview Cut): VO sourced from the original talking-head shoot; declarative, authoritative register; existing audio reused

Output format (JSON):
{
  "audio_script": "the script as the VO will deliver it (may be tightened from source)",
  "broll_timeline": [{"timestamp_start": "0:00", "timestamp_end": "0:00", "broll_description": "string", "purpose": "string"}],
  "pacing_notes": "1-2 sentences on rhythm",
  "audio_treatment_notes": "1-2 sentences on register and recording approach"
}`;

export const VOICEOVER_USER_PROMPT = `Translate this script into a voiceover-with-b-roll brief.

Register chosen: {{register}}

Source script:
"""
{{script}}
"""

Channel context:
- Audience: {{audience}}
- Channel: {{channel}}

For "Friend" register: tighten the script for a 30-45 second VO; recommend the vulnerable register treatment. For "Professor extended": preserve the script as-is for use as Interview Cut audio. In both cases, design a b-roll timeline that supports the audio without literalizing every word.

Respond with only the JSON object.`;
