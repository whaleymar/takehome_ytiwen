export const MAX_COMPARE = 3

export type Better = 'lower' | 'higher'

/** Scores compare element by element, so [rateMin, rateMax] breaks ties on the second value. */
export type Score = number[] | null

function compareScores(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * Indexes of the best score(s) in a row. Ties for best are all returned.
 * Returns nothing when there's no real difference to point out: fewer than two
 * comparable values, or every comparable value is equal. Null scores never win.
 */
export function bestIndexes(scores: Score[], better: Better): Set<number> {
  const present = scores.flatMap((s, i) => (s === null ? [] : [{ s, i }]))
  if (present.length < 2) return new Set()

  const sign = better === 'lower' ? 1 : -1
  const best = present.reduce((a, b) => (sign * compareScores(b.s, a.s) < 0 ? b : a)).s
  if (present.every(({ s }) => compareScores(s, best) === 0)) return new Set()

  return new Set(present.filter(({ s }) => compareScores(s, best) === 0).map(({ i }) => i))
}

/** Adds or removes an id, refusing to go past MAX_COMPARE. */
export function toggleCompareId(ids: string[], id: string): string[] {
  if (ids.includes(id)) return ids.filter((x) => x !== id)
  return ids.length < MAX_COMPARE ? [...ids, id] : ids
}
