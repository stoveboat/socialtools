import type { DimensionId, Grade } from "./types";

export type PassId = "foundation" | "engagement_structure" | "surface";

export const PASSES_IN_ORDER: PassId[] = [
  "foundation",
  "engagement_structure",
  "surface",
];

export const PASS_LABEL: Record<PassId, string> = {
  foundation: "Foundation pass",
  engagement_structure: "Engagement & Structure pass",
  surface: "Surface pass",
};

export const PASS_BLURB: Record<PassId, string> = {
  foundation:
    "Establishes spine, audience, payoff, and channel positioning together. The biggest editorial unit — most consequential, most disruptive, run first when needed.",
  engagement_structure:
    "Sets the engagement engine, authority frame, hook, and structural shape so the script earns and holds attention.",
  surface:
    "Tightens texture, removes padding, smooths voice consistency. Polish only — does not change spine, payoff, or shape.",
};

// Which dimensions does each pass take responsibility for? These are
// editorial groupings (not strict tiers) — Payoff lives with Foundation
// because the close cannot be set until the spine is, even though Payoff is
// graded as Engagement architecture.
export const PASS_DIMENSIONS: Record<PassId, DimensionId[]> = {
  foundation: ["spine", "audience", "payoff", "off_positioning"],
  engagement_structure: ["tension", "authority", "hook", "structure"],
  surface: ["specificity", "compression", "voice"],
};

const isWeak = (g: Grade) => g === "C" || g === "D" || g === "F";

export function passesNeeded<
  T extends { dimension_id: string; grade: Grade },
>(grades: T[]): PassId[] {
  const weakIds = new Set(
    grades.filter((g) => isWeak(g.grade)).map((g) => g.dimension_id),
  );
  const needed: PassId[] = [];
  for (const passId of PASSES_IN_ORDER) {
    if (PASS_DIMENSIONS[passId].some((id) => weakIds.has(id))) {
      needed.push(passId);
    }
  }
  return needed;
}

// The seven payoff types from the design.
export const PAYOFF_TYPES = [
  {
    id: "tactic",
    label: "Tactic",
    blurb: "Something to do. The viewer leaves with an action.",
  },
  {
    id: "permission",
    label: "Permission",
    blurb:
      "Something the viewer can stop feeling guilty about. Frees them from a constraint.",
  },
  {
    id: "reframe",
    label: "Reframe",
    blurb: "A new way of seeing something familiar.",
  },
  {
    id: "language",
    label: "Language",
    blurb: "Words for something the viewer already felt but couldn't name.",
  },
  {
    id: "recognition",
    label: "Recognition",
    blurb: "The feeling of being seen. Triggers \"me too\".",
  },
  {
    id: "tribe_flag",
    label: "Tribe-flag",
    blurb: "Content that signals identity. The viewer shares to belong.",
  },
  {
    id: "atmosphere",
    label: "Atmosphere",
    blurb: "A feeling the viewer wants to dwell in.",
  },
] as const;

// Engagement engines for Pass 2.
export const ENGAGEMENT_ENGINES = [
  {
    id: "curiosity_gap",
    label: "Curiosity gap",
    blurb:
      "A question, contradiction, or counterintuitive claim the viewer needs resolved.",
  },
  {
    id: "contrarian_flip",
    label: "Contrarian flip",
    blurb: "Name a common belief and dismantle it.",
  },
  {
    id: "recognition",
    label: "Recognition",
    blurb:
      "Open with a vulnerable observation that triggers \"me too\" — works when the audience is the topic.",
  },
  {
    id: "utility",
    label: "Utility",
    blurb:
      "Open with a savable, practical promise. The viewer keeps watching for the steps.",
  },
  {
    id: "insight",
    label: "Insight",
    blurb: "Open with an unexpected connection between two familiar things.",
  },
] as const;

// Structural shapes for Pass 2.
export const STRUCTURAL_SHAPES = [
  {
    id: "hook_value_payoff",
    label: "Hook → Value → Payoff",
    blurb: "The universal short-form scaffold. Three clear sections.",
  },
  {
    id: "pain_agitate_tease_solution",
    label: "Pain → Agitate → Tease → Solution",
    blurb:
      "Problem-solution. Name the pain, intensify, tease the resolution, deliver.",
  },
  {
    id: "story_empathy_advice",
    label: "Story → Empathy → Advice",
    blurb:
      "Storytelling. Tell a specific moment, name the feeling, hand over the takeaway.",
  },
  {
    id: "numbered_list",
    label: "Numbered List Authority",
    blurb: "Three to five tight points with a brief conclusion.",
  },
  {
    id: "setup_subversion_resolution",
    label: "Setup → Subversion → Resolution",
    blurb: "Contrarian. Set up the expected, subvert it, resolve to the new frame.",
  },
] as const;

export type PayoffTypeId = (typeof PAYOFF_TYPES)[number]["id"];
export type EngagementEngineId = (typeof ENGAGEMENT_ENGINES)[number]["id"];
export type StructuralShapeId = (typeof STRUCTURAL_SHAPES)[number]["id"];
