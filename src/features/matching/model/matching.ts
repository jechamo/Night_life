import type { Gender, InterestedIn } from '@/features/onboarding/model/onboarding-machine'
import type { Candidate, MatchingProfile } from './people'

const CATEGORY: Record<Gender, InterestedIn | null> = {
  woman: 'women',
  man: 'men',
  non_binary: 'non_binary',
  // "Other" only matches people open to everyone (all three categories).
  other: null,
}

function wants(seeker: MatchingProfile, target: MatchingProfile): boolean {
  const category = CATEGORY[target.gender]
  const accepts = category
    ? seeker.interestedIn.includes(category)
    : seeker.interestedIn.length === 3
  return accepts && target.age >= seeker.ageMin && target.age <= seeker.ageMax
}

/**
 * Compatibility both ways (PRD 6.6). Red light, discreet mode and blocks hide a
 * person from swipes entirely. Rules only, no AI (PRD 6.12 C).
 */
export function isMutuallyCompatible(
  me: MatchingProfile,
  other: MatchingProfile,
  blocked: ReadonlySet<string> = new Set(),
): boolean {
  if (other.id === me.id || blocked.has(other.id)) return false
  if (other.trafficLight === 'red' || other.discreet) return false
  return wants(me, other) && wants(other, me)
}

/** Priority groups (PRD 5.3): same place now, same place tonight, nearby; verified first. */
export function priorityGroup(c: Candidate): 0 | 1 | 2 {
  if (c.context.sameVenueNow) return 0
  if (c.context.sameVenueTonight) return 1
  return 2
}

export function rankCandidates(
  candidates: readonly Candidate[],
  onlyVerified: boolean,
): Candidate[] {
  return candidates
    .filter((c) => !onlyVerified || c.profile.photoVerified)
    .map((c, index) => ({ c, index }))
    .sort(
      (a, b) =>
        (a.c.visibilityPriority ?? 2) - (b.c.visibilityPriority ?? 2) ||
        priorityGroup(a.c) - priorityGroup(b.c) ||
        Number(b.c.profile.photoVerified) - Number(a.c.profile.photoVerified) ||
        (a.c.context.distanceMeters ?? Infinity) - (b.c.context.distanceMeters ?? Infinity) ||
        a.index - b.index,
    )
    .map(({ c }) => c)
}

/** PRD 6.6: free daily likes, configurable (5 by default); unlimited with `unlimited_likes`. */
export const FREE_DAILY_LIKES = 5

export function likesRemaining(
  usedToday: number,
  unlimited: boolean,
  limit = FREE_DAILY_LIKES,
): number {
  return unlimited ? Number.POSITIVE_INFINITY : Math.max(0, limit - usedToday)
}

export type IcebreakerKey =
  'hereNow' | 'tonight' | 'artist' | 'generic.plan' | 'generic.song' | 'generic.spot'

export interface Icebreaker {
  key: IcebreakerKey
  params: Record<string, string>
}

/** Rule-based icebreakers from the shared place or artist (PRD 6.6.1). Never AI. */
export function suggestIcebreakers(context: Candidate['context']): Icebreaker[] {
  const out: Icebreaker[] = []
  if (context.venueName && context.sameVenueNow)
    out.push({ key: 'hereNow', params: { place: context.venueName } })
  else if (context.venueName && context.sameVenueTonight)
    out.push({ key: 'tonight', params: { place: context.venueName } })
  if (context.sharedArtist) out.push({ key: 'artist', params: { artist: context.sharedArtist } })
  const generic: Icebreaker[] = [
    { key: 'generic.plan', params: {} },
    { key: 'generic.song', params: {} },
    { key: 'generic.spot', params: {} },
  ]
  return [...out, ...generic].slice(0, 3)
}

export type MatchTitle =
  { key: 'here'; place: string } | { key: 'tonight'; place: string } | { key: 'generic' }

/** "¡Match en Kapital!" vs "¡Los dos vais a Kapital esta noche!" (PRD 6.6.1). */
export function matchTitle(context: Candidate['context']): MatchTitle {
  if (context.venueName && context.sameVenueNow) return { key: 'here', place: context.venueName }
  if (context.venueName && context.sameVenueTonight)
    return { key: 'tonight', place: context.venueName }
  return { key: 'generic' }
}
