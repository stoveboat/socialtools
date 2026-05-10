import type { DimensionId } from "./types";

// Dimensions form a dependency hierarchy. Higher tiers are foundational to
// lower tiers — fixing Tier 1 (Spine, Audience, Off-positioning) reshapes
// what Tier 2 (Tension, Authority, Payoff) can deliver, which reshapes what
// Tier 3 (Hook, Structure) needs to do, which constrains Tier 4 (Specificity,
// Compression, Voice). Repairing in tier order means each fix operates on a
// stable foundation; repairing in arbitrary order produces situations where
// downstream fixes are about to be invalidated by the next upstream one.
//
// Within a tier, ordering is conventional (the order the dimensions are
// listed in the design docs). The dimensions in a single tier are sibling
// concerns — Spine before Audience or Audience before Spine usually doesn't
// matter much.

export const TIER_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "Foundation",
  2: "Engagement architecture",
  3: "Structural execution",
  4: "Surface execution",
};

export interface DimensionTier {
  tier: 1 | 2 | 3 | 4;
  within_tier: number;
}

export const DIMENSION_TIERS: Record<DimensionId, DimensionTier> = {
  // Tier 1 — Foundation: what is the script saying, who is it for, where
  // does it belong?
  spine: { tier: 1, within_tier: 0 },
  audience: { tier: 1, within_tier: 1 },
  off_positioning: { tier: 1, within_tier: 2 },

  // Tier 2 — Engagement Architecture: what's the engine, why this speaker,
  // what does the viewer leave with?
  tension: { tier: 2, within_tier: 0 },
  authority: { tier: 2, within_tier: 1 },
  payoff: { tier: 2, within_tier: 2 },

  // Tier 3 — Structural Execution: how the foundation gets shaped into
  // delivered content.
  hook: { tier: 3, within_tier: 0 },
  structure: { tier: 3, within_tier: 1 },

  // Tier 4 — Surface Execution: texture and finish, applied after the
  // content is the right content.
  specificity: { tier: 4, within_tier: 0 },
  compression: { tier: 4, within_tier: 1 },
  voice: { tier: 4, within_tier: 2 },
};

const FALLBACK = { tier: 4, within_tier: 99 } as const;

export function getTier(dimensionId: string): DimensionTier {
  return (
    DIMENSION_TIERS[dimensionId as DimensionId] ?? (FALLBACK as DimensionTier)
  );
}

export function getTierLabel(dimensionId: string): string {
  return TIER_LABELS[getTier(dimensionId).tier];
}

export function orderByTier<T extends { dimension_id: string }>(
  items: T[],
): T[] {
  return items.slice().sort((a, b) => {
    const ta = getTier(a.dimension_id);
    const tb = getTier(b.dimension_id);
    if (ta.tier !== tb.tier) return ta.tier - tb.tier;
    return ta.within_tier - tb.within_tier;
  });
}

// Given the current grades and the set of dimensions the user has already
// addressed (accepted, edited, skipped, or auto_resolved), compute the
// remaining repair queue ordered by tier.
export function computeQueue<
  T extends { dimension_id: string; grade: string },
>(grades: T[], addressedIds: Set<string>): T[] {
  const isWeak = (g: string) => g === "C" || g === "D" || g === "F";
  const remaining = grades.filter(
    (g) => isWeak(g.grade) && !addressedIds.has(g.dimension_id),
  );
  return orderByTier(remaining);
}

// Display order for the persistent grade strip — also tier order so the user
// sees Foundation at the left, Surface Execution at the right.
export const DIMENSIONS_BY_TIER: DimensionId[] = (
  Object.entries(DIMENSION_TIERS) as [DimensionId, DimensionTier][]
)
  .sort((a, b) => {
    if (a[1].tier !== b[1].tier) return a[1].tier - b[1].tier;
    return a[1].within_tier - b[1].within_tier;
  })
  .map(([id]) => id);
