import type { DimensionId } from "./types";

// Approximate "where in the script does this dimension's fix land?" priority.
// Lower number = earlier in the script. The exact position varies per fix
// (a Spine fix might land at the open OR the close, an Authority fix could
// be anywhere a hedge appears) but this gives the user a sensible default
// order: Hook first when weak, CTA-shaped Payoff last.
export const POSITION_PRIORITY: Record<DimensionId, number> = {
  hook: 0, //                  first 1-3 sentences
  tension: 1, //               opening loop
  spine: 2, //                 typically near the open
  audience: 3, //              top half tends to set audience cues
  authority: 4, //             top-half claims need authority
  voice: 5, //                 throughout
  structure: 6, //             throughout
  specificity: 7, //           throughout
  compression: 8, //           throughout
  off_positioning: 9, //       evaluated against the whole piece
  payoff: 10, //               closing — always last
};

const FALLBACK_PRIORITY = 99;

export function orderByPosition<T extends { dimension_id: string }>(
  items: T[],
): T[] {
  return items.slice().sort((a, b) => {
    const pa =
      POSITION_PRIORITY[a.dimension_id as DimensionId] ?? FALLBACK_PRIORITY;
    const pb =
      POSITION_PRIORITY[b.dimension_id as DimensionId] ?? FALLBACK_PRIORITY;
    return pa - pb;
  });
}

// Given the current state of dimension grades (post-apply) and the set of
// dimension_ids the user has already addressed (accepted, edited, or skipped),
// compute the remaining queue ordered by text position.
export function computeQueue<
  T extends { dimension_id: string; grade: string },
>(grades: T[], addressedIds: Set<string>): T[] {
  const isWeak = (g: string) => g === "C" || g === "D" || g === "F";
  const remaining = grades.filter(
    (g) => isWeak(g.grade) && !addressedIds.has(g.dimension_id),
  );
  return orderByPosition(remaining);
}
