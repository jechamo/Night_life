import type { Place } from './types'

export const MAX_SPONSORED_ON_TOP = 2
export const SPONSORED_EVERY = 5

/**
 * Sponsored placement (PRD 6.5, 6.11): sponsored places only appear if they already
 * passed the user's filters (callers pass filtered lists), at most 2 on top and then
 * at most 1 in every block of 5 results. They never change the stats.
 */
export function placeSponsored(results: readonly Place[]): Place[] {
  const sponsored = results
    .filter((p) => p.sponsored && p.sponsorshipTier !== 'featured')
    .sort((a, b) => Number(b.sponsorshipTier === 'top') - Number(a.sponsorshipTier === 'top'))
  const organic = results.filter((p) => !p.sponsored || p.sponsorshipTier === 'featured')
  const out: Place[] = sponsored.splice(0, MAX_SPONSORED_ON_TOP)
  let sinceLast = 0
  for (const place of organic) {
    if (sinceLast === SPONSORED_EVERY - 1 && sponsored.length > 0) {
      out.push(sponsored.shift()!)
      sinceLast = 0
    }
    out.push(place)
    sinceLast += 1
  }
  // Remaining sponsored results stay out: slots are limited.
  return out
}
