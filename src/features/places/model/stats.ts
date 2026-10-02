import type { PlaceStats } from './types'

/** PRD 4.3: below 5 people nothing but "less than 5" is shown. */
export const STATS_MIN_PEOPLE = 5

export interface PresentedStats {
  people: { kind: 'exact'; value: number } | { kind: 'less_than'; value: number }
  averageAge: number | null
  greenPercent: number | null
  ratio: PlaceStats['ratio']
  goingTonight: number
}

/**
 * Applies the privacy thresholds client-side as well (defence in depth: the
 * server already aggregates and thresholds before sending anything).
 */
export function presentStats(stats: PlaceStats): PresentedStats {
  const enough = stats.people >= STATS_MIN_PEOPLE
  return {
    people: enough
      ? { kind: 'exact', value: stats.people }
      : { kind: 'less_than', value: STATS_MIN_PEOPLE },
    averageAge: enough ? stats.averageAge : null,
    greenPercent: enough ? stats.greenPercent : null,
    ratio: enough ? stats.ratio : null,
    goingTonight: stats.goingTonight,
  }
}

/** Share of votes per vibe, in %, rounded. Empty when nobody voted. */
export function vibeShares<K extends string>(
  votes: Record<K, number>,
): { key: K; percent: number }[] {
  const total = Object.values<number>(votes).reduce((a, b) => a + b, 0)
  if (total === 0) return []
  return (Object.entries(votes) as [K, number][])
    .map(([key, count]) => ({ key, percent: Math.round((count / total) * 100) }))
    .sort((a, b) => b.percent - a.percent)
}
