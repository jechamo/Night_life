import { describe, expect, it } from 'vitest'
import {
  isMutuallyCompatible,
  likesRemaining,
  matchTitle,
  rankCandidates,
  suggestIcebreakers,
} from './matching'
import type { Candidate, MatchingProfile } from './people'

const person = (over: Partial<MatchingProfile>): MatchingProfile => ({
  id: 'x',
  name: 'X',
  age: 30,
  gender: 'woman',
  bio: '',
  photos: [],
  photoVerified: false,
  trafficLight: 'green',
  anthem: null,
  interestedIn: ['men'],
  ageMin: 25,
  ageMax: 40,
  discreet: false,
  ...over,
})

const me = person({ id: 'me', gender: 'man', interestedIn: ['women'], age: 32 })

describe('compatibility (both ways)', () => {
  it('matches when both want each other', () => {
    expect(isMutuallyCompatible(me, person({ id: 'a' }))).toBe(true)
  })
  it('fails if only one side is interested', () => {
    expect(isMutuallyCompatible(me, person({ id: 'a', interestedIn: ['women'] }))).toBe(false)
  })
  it('respects both age ranges', () => {
    expect(isMutuallyCompatible(me, person({ id: 'a', age: 45 }))).toBe(false)
    expect(isMutuallyCompatible(me, person({ id: 'a', ageMax: 30 }))).toBe(false)
  })
  it('red light, discreet mode and blocks hide people', () => {
    expect(isMutuallyCompatible(me, person({ id: 'a', trafficLight: 'red' }))).toBe(false)
    expect(isMutuallyCompatible(me, person({ id: 'a', discreet: true }))).toBe(false)
    expect(isMutuallyCompatible(me, person({ id: 'a' }), new Set(['a']))).toBe(false)
  })
  it('yellow (friendship) still appears', () => {
    expect(isMutuallyCompatible(me, person({ id: 'a', trafficLight: 'yellow' }))).toBe(true)
  })
})

const cand = (id: string, verified: boolean, ctx: Partial<Candidate['context']>): Candidate => ({
  profile: { ...person({ id }), photoVerified: verified },
  context: {
    sameVenueNow: false,
    sameVenueTonight: false,
    distanceMeters: null,
    venueName: null,
    sharedArtist: null,
    ...ctx,
  },
})

describe('swipe priority (PRD 5.3)', () => {
  const list = [
    cand('near', true, { distanceMeters: 300 }),
    cand('tonight', false, { sameVenueTonight: true }),
    cand('here-unverified', false, { sameVenueNow: true }),
    cand('here-verified', true, { sameVenueNow: true }),
  ]
  it('orders by group, then verified photo first', () => {
    expect(rankCandidates(list, false).map((c) => c.profile.id)).toEqual([
      'here-verified',
      'here-unverified',
      'tonight',
      'near',
    ])
  })
  it('"Solo verificados" is a free filter', () => {
    expect(rankCandidates(list, true).map((c) => c.profile.id)).toEqual(['here-verified', 'near'])
  })
})

describe('likes, icebreakers and match title', () => {
  it('5 free likes a day, unlimited with the entitlement', () => {
    expect(likesRemaining(3, false)).toBe(2)
    expect(likesRemaining(9, false)).toBe(0)
    expect(likesRemaining(9, true)).toBe(Infinity)
  })
  it('icebreakers use the shared place and artist', () => {
    const ctx = {
      sameVenueNow: true,
      sameVenueTonight: false,
      distanceMeters: 0,
      venueName: 'Kapital',
      sharedArtist: 'Rosalía',
    }
    expect(suggestIcebreakers(ctx).map((i) => i.key)).toEqual(['hereNow', 'artist', 'generic.plan'])
  })
  it('contextual match titles', () => {
    const base = { distanceMeters: null, sharedArtist: null, venueName: 'Kapital' }
    expect(matchTitle({ ...base, sameVenueNow: true, sameVenueTonight: false })).toEqual({
      key: 'here',
      place: 'Kapital',
    })
    expect(matchTitle({ ...base, sameVenueNow: false, sameVenueTonight: true })).toEqual({
      key: 'tonight',
      place: 'Kapital',
    })
    expect(
      matchTitle({ ...base, sameVenueNow: false, sameVenueTonight: false, venueName: null }),
    ).toEqual({ key: 'generic' })
  })
})
