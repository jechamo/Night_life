import type { AccentKey } from '@/shared/domain/venue-types'

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
  /** 1-4 (€ to €€€€). */
  price: 1 | 2 | 3 | 4
  hours: string
  openNow: boolean
  rating: number | null
  sponsored: boolean
  stats: PlaceStats
  vibes: Record<Vibe, number>
  event?: PlaceEvent
}

export const isEvent = (place: Place): place is Place & { event: PlaceEvent } =>
  place.event !== undefined
