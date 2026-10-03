import type { AccentKey } from '@/shared/domain/venue-types'
import { distanceMeters } from './geo'
import { presentStats } from './stats'
import { isEvent, type LatLng, type Place } from './types'

export type PlaceScope = 'all' | 'venues' | 'events'
export type PlaceSort = 'distance' | 'most_people' | 'least_people' | 'average_age' | 'rating'

/** Every filter is free (PRD 6.5). */
export interface PlaceFilters {
  text: string
  scope: PlaceScope
  types: readonly AccentKey[]
  minPeople: number
  ageRange: readonly [number, number] | null
  minGreenPercent: number
  maxDistanceKm: number | null
  maxPrice: 1 | 2 | 3 | 4
  openNow: boolean
  sort: PlaceSort
}

export const DEFAULT_FILTERS: PlaceFilters = {
  text: '',
  scope: 'all',
  types: [],
  minPeople: 0,
  ageRange: null,
  minGreenPercent: 0,
  maxDistanceKm: null,
  maxPrice: 4,
  openNow: false,
  sort: 'distance',
}

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

export function applyFilters(places: readonly Place[], f: PlaceFilters, origin: LatLng): Place[] {
  const text = normalize(f.text)
  const withDistance = places.map((place) => ({
    place,
    distance: distanceMeters(origin, place.location),
  }))
  const filtered = withDistance.filter(({ place, distance }) => {
    const stats = presentStats(place.stats)
    if (f.scope === 'venues' && isEvent(place)) return false
    if (f.scope === 'events' && !isEvent(place)) return false
    if (text && !normalize(`${place.name} ${place.address}`).includes(text)) return false
    if (f.types.length > 0 && !f.types.includes(place.type)) return false
    if (f.minPeople > 0 && place.stats.people < f.minPeople) return false
    if (f.ageRange) {
      // Places below the privacy threshold have no average age: they can't match an age filter.
      if (stats.averageAge === null) return false
      if (stats.averageAge < f.ageRange[0] || stats.averageAge > f.ageRange[1]) return false
    }
    if (f.minGreenPercent > 0 && (stats.greenPercent ?? -1) < f.minGreenPercent) return false
    if (f.maxDistanceKm !== null && distance > f.maxDistanceKm * 1000) return false
    // An unknown price can't be promised to fit a budget.
    if (f.maxPrice < 4 && (place.price ?? 5) > f.maxPrice) return false
    if (f.openNow && !place.openNow) return false
    return true
  })
  const by: Record<
    PlaceSort,
    (a: (typeof filtered)[number], b: (typeof filtered)[number]) => number
  > = {
    distance: (a, b) => a.distance - b.distance,
    most_people: (a, b) => b.place.stats.people - a.place.stats.people,
    least_people: (a, b) => a.place.stats.people - b.place.stats.people,
    average_age: (a, b) => (a.place.stats.averageAge ?? 999) - (b.place.stats.averageAge ?? 999),
    rating: (a, b) => (b.place.rating ?? 0) - (a.place.rating ?? 0),
  }
  return filtered.sort(by[f.sort]).map(({ place }) => place)
}

export const activeFilterCount = (f: PlaceFilters): number =>
  [
    f.types.length > 0,
    f.minPeople > 0,
    f.ageRange !== null,
    f.minGreenPercent > 0,
    f.maxDistanceKm !== null,
    f.maxPrice < 4,
    f.openNow,
  ].filter(Boolean).length
