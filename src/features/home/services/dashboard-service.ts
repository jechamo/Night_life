import type { CityName } from '@/features/places/model/cities'
import type { LatLng, Place } from '@/features/places/model/types'

export interface DashboardSummary {
  nearby: Place[]
  tonight: Place[]
  now: Place[]
  favorites: Place[]
  favoritesTotal: number
  social: { newLikes: number; pendingChats: number; totalChats: number; matches: number } | null
}

/** Aggregate reads never reserve a map load or hydrate social profiles. */
export interface DashboardService {
  summary(city: CityName, origin: LatLng): Promise<DashboardSummary>
  favorites(offset: number): Promise<{ places: Place[]; total: number }>
  setFavorite(placeId: string, saved: boolean): Promise<void>
}
