import { z } from 'zod'
import type { DashboardService } from '@/features/home/services/dashboard-service'
import type { Place } from '@/features/places/model/types'
import type { Db } from './client'
import { must } from './errors'
import { venueToPlace } from './places'

const count = z.number().int().nonnegative()
const row = z.record(z.string(), z.unknown())
const page = z.object({ places: z.array(row), total: count })
const summary = z.object({
  nearby: z.array(row).max(5),
  tonight: z.array(row).max(3),
  now: z.array(row).max(3),
  favorites: z.array(row).max(4),
  favoritesTotal: count,
  social: z
    .object({ newLikes: count, pendingChats: count, totalChats: count, matches: count })
    .nullable(),
})

export function dashboardPlaces(rows: Record<string, unknown>[]): Place[] {
  return rows.flatMap((r) => {
    const place = venueToPlace(r, typeof r.description === 'string' ? r.description : '')
    return place
      ? [
          {
            ...place,
            favorite: r.favorite === true,
            sponsored: r.sponsored === true,
            sponsorshipTier:
              r.sponsorshipTier === 'top' ||
              r.sponsorshipTier === 'featured_plus' ||
              r.sponsorshipTier === 'featured'
                ? r.sponsorshipTier
                : undefined,
          },
        ]
      : []
  })
}

export function createDashboardService(db: Db): DashboardService {
  return {
    async summary(city, origin) {
      const result = summary.parse(
        must(
          await db.rpc('home_summary', {
            p_city: city,
            p_lat: origin.lat,
            p_lng: origin.lng,
          }),
        ),
      )
      return {
        ...result,
        nearby: dashboardPlaces(result.nearby),
        tonight: dashboardPlaces(result.tonight),
        now: dashboardPlaces(result.now),
        favorites: dashboardPlaces(result.favorites),
      }
    },
    async favorites(offset) {
      const result = page.parse(must(await db.rpc('favorites_list', { p_offset: offset })))
      return { places: dashboardPlaces(result.places), total: result.total }
    },
    async setFavorite(placeId, saved) {
      must(await db.rpc('favorite_set', { p_place: placeId, p_saved: saved }))
    },
  }
}
