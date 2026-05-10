import type { DimensionId } from "./types";

// The eleven dimensions form a dependency hierarchy. Higher tiers are
// foundational to lower tiers — fixing Tier 1 reshapes what Tier 2 can
// deliver, which reshapes what Tier 3 needs to do, which constrains Tier 4.
//
// Tiers describe DEPENDENCY for diagnostic visualization. Editorial passes
// (lib/diagnostics/passes.ts) describe REVISION units, which group
// dimensions slightly differently — Payoff lives with Foundation editorially
// even though it grades as Engagement Architecture.

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
  spine: { tier: 1, within_tier: 0 },
  audience: { tier: 1, within_tier: 1 },
  off_positioning: { tier: 1, within_tier: 2 },
  tension: { tier: 2, within_tier: 0 },
  authority: { tier: 2, within_tier: 1 },
  payoff: { tier: 2, within_tier: 2 },
  hook: { tier: 3, within_tier: 0 },
  structure: { tier: 3, within_tier: 1 },
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

// Display order for the persistent grade strip, sorted by tier then by the
// within-tier index. Foundation on the left, Surface Execution on the right.
export const DIMENSIONS_BY_TIER: DimensionId[] = (
  Object.entries(DIMENSION_TIERS) as [DimensionId, DimensionTier][]
)
  .sort((a, b) => {
    if (a[1].tier !== b[1].tier) return a[1].tier - b[1].tier;
    return a[1].within_tier - b[1].within_tier;
  })
  .map(([id]) => id);
