import type { Gender, InterestedIn } from '@/features/onboarding/model/onboarding-machine'

/** Traffic light (PRD 6.6): green open to flirt, yellow friendship only, red invisible in swipes. */
export type TrafficLight = 'green' | 'yellow' | 'red'

export interface Anthem {
  title: string
  artist: string
}

/** Public profile: only what the public view exposes (PRD 6.15 API3). */
export interface PublicProfile {
  id: string
  name: string
  age: number
  gender: Gender
  bio: string
  photos: readonly string[]
  photoVerified: boolean
  trafficLight: TrafficLight
  anthem: Anthem | null
}

/** Matching-only data the server uses; never shown. */
export interface MatchingProfile extends PublicProfile {
  interestedIn: readonly InterestedIn[]
  ageMin: number
  ageMax: number
  discreet: boolean
}

export interface Candidate {
  profile: PublicProfile
  /** Where they are relative to me (no exact location or times are ever exposed). */
  context: {
    sameVenueNow: boolean
    sameVenueTonight: boolean
    /** Distance band in metres between venues, null if unknown. */
    distanceMeters: number | null
    venueName: string | null
    sharedArtist: string | null
  }
}
