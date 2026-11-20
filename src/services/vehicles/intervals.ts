/** Half-open time interval [starts, ends). */
export type Interval = { starts: Date; ends: Date }

/** Two intervals overlap when a.starts < b.ends && b.starts < a.ends (touching ends do not overlap). */
export function intervalsOverlap(a: Interval, b: Interval): boolean {
  return a.starts.getTime() < b.ends.getTime() && b.starts.getTime() < a.ends.getTime()
}

/** Rate validity window. `effectiveTo: null` is open-ended (treated as far future). */
export type RateRange = { effectiveFrom: Date; effectiveTo: Date | null }

const FAR_FUTURE = Number.POSITIVE_INFINITY

function rangeEnd(range: RateRange): number {
  return range.effectiveTo === null ? FAR_FUTURE : range.effectiveTo.getTime()
}

/** Rate ranges are half-open [effectiveFrom, effectiveTo): a card may start exactly where another ends. */
export function rateRangesOverlap(a: RateRange, b: RateRange): boolean {
  return a.effectiveFrom.getTime() < rangeEnd(b) && b.effectiveFrom.getTime() < rangeEnd(a)
}

/** Returns the first existing card whose range overlaps the candidate, or null. */
export function findOverlappingRate<T extends RateRange>(
  existing: readonly T[],
  candidate: RateRange,
): T | null {
  return existing.find((card) => rateRangesOverlap(card, candidate)) ?? null
}
