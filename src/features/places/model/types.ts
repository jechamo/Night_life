import type { AccentKey } from '@/shared/domain/venue-types'
import type { OpeningPeriod } from './cities'

export interface LatLng {
  lat: number
  lng: number
}

export type EventStatus =
  'unconfirmed' | 'confirmed' | 'official' | 'hidden' | 'deleted' | 'archived'
export type EventOrigin = 'user' | 'venue' | 'import'

/** Aggregated, already-anonymised numbers (PRD 4.3, 6.4). Never individual data. */
export interface PlaceStats {
  people: number
  averageAge: number | null
  /** % of people with the green traffic light (open to flirt). */
  greenPercent: number | null
  /** Gender split in %, women / men / other. */
  ratio: { women: number; men: number; other: number } | null
  goingTonight: number
}

export const VIBES = ['fire', 'music', 'chill', 'packed', 'friendly'] as const
export type Vibe = (typeof VIBES)[number]

export interface PlaceEvent {
  /** Style of the generic illustrative cover while event photos are unavailable. */
  coverStyle?: 'concert' | 'techno' | 'open_air'
  status: EventStatus
  origin: EventOrigin
  startsAt: string
  endsAt: string
  createdAt: string
  confirmations: number
  fakeReports: number
  description: string
}

export interface Place {
  id: string
  name: string
  /** Venue type, or 'event'. Drives the accent colour (PRD 8.2). */
  type: AccentKey
  location: LatLng
  address: string
  /** 1-4 (€ to €€€€); unknown for imported venues until someone sets it. */
  price?: 1 | 2 | 3 | 4
  hours: string
  openNow: boolean
  rating: number | null
  sponsored: boolean
  sponsorshipTier?: 'featured' | 'featured_plus' | 'top'
  stats: PlaceStats
  vibes: Record<Vibe, number>
  event?: PlaceEvent
  /** Catalogue details (Block 7): editorial data owned by Nightlife, never copied from Google. */
  city?: string
  description?: string
  phone?: string
  website?: string
  openingHours?: readonly OpeningPeriod[]
  music?: readonly string[]
  dressCode?: string
  minAge?: number
  /** Imported from OpenStreetMap: the details show the ODbL attribution. */
  source?: 'osm'
}

export const isEvent = (place: Place): place is Place & { event: PlaceEvent } =>
  place.event !== undefined
