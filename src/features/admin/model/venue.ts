import type { OpeningPeriod } from '@/features/places/model/cities'
import type { VenueType } from '@/shared/domain/venue-types'

/** Own catalogue entry as edited in Admin › Locales (ADR 0010: no Google content stored). */
export interface AdminVenue {
  id: string
  name: string
  type: VenueType
  city: string
  address: string
  description: string
  hours: string
  price: 1 | 2 | 3 | 4
  phone: string
  website: string
  music: string[]
  dressCode: string
  minAge: number | null
  notes: string
  openingHours: OpeningPeriod[]
  isTest: boolean
  /** `owner` = coordinates set by our team; `google` = cached place (expires). */
  locationSource: string
  /** `null` once cached Google coordinates have expired (30 days). */
  lat: number | null
  lng: number | null
}

export type VenueInput = Omit<AdminVenue, 'id' | 'isTest' | 'locationSource' | 'lat' | 'lng'> & {
  lat: number
  lng: number
}

export const PHONE_RE = /^\+?[0-9 ()-]{6,20}$/
export const OPENING_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export type VenueField =
  | 'name'
  | 'city'
  | 'address'
  | 'lat'
  | 'lng'
  | 'phone'
  | 'website'
  | 'minAge'
  | 'description'
  | 'openingHours'

/** Same rules as `private.update_venue_details`, checked before the round trip. */
export function venueInputErrors(v: VenueInput): VenueField[] {
  const errors: VenueField[] = []
  if (v.name.trim().length < 2 || v.name.trim().length > 80) errors.push('name')
  if (!v.city.trim()) errors.push('city')
  if (!v.address.trim()) errors.push('address')
  if (!Number.isFinite(v.lat) || Math.abs(v.lat) > 90) errors.push('lat')
  if (!Number.isFinite(v.lng) || Math.abs(v.lng) > 180) errors.push('lng')
  if (v.phone && !PHONE_RE.test(v.phone)) errors.push('phone')
  if (v.website && !/^https:\/\/[^\s]+$/.test(v.website)) errors.push('website')
  if (v.minAge !== null && (v.minAge < 18 || v.minAge > 25)) errors.push('minAge')
  if (v.description.length > 500) errors.push('description')
  if (
    v.openingHours.some(
      (p) => p.day < 0 || p.day > 6 || !OPENING_RE.test(p.opens) || !OPENING_RE.test(p.closes),
    )
  )
    errors.push('openingHours')
  return errors
}
