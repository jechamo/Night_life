import { z } from 'zod'
import type { MatchingService, TravelState } from '@/features/matching/services/matching-service'
import { err, ok } from '@/shared/lib/result'
import type { Db } from './client'
import { must } from './errors'

const travelState = z.object({
  enabled: z.boolean(),
  entitled: z.boolean(),
  homeCity: z.string().nullable(),
  city: z.string().nullable(),
  endsAt: z.string().nullable(),
  active: z.boolean(),
})
const travelError = z.object({
  error: z.enum(['disabled', 'premium_required', 'invalid', 'same_city']),
})

/** Block 11b: travel mode RPCs (flag, `travel_mode` benefit and limits checked server-side). */
export function createTravelMethods(
  db: Db,
): Required<Pick<MatchingService, 'travelState' | 'setTravel' | 'clearTravel'>> {
  return {
    travelState: async (): Promise<TravelState> =>
      travelState.parse(must(await db.rpc('travel_state'))),
    async setTravel(city, days) {
      const value = must(await db.rpc('travel_set', { p_city: city, p_days: days }))
      const refused = travelError.safeParse(value)
      return refused.success ? err(refused.data.error) : ok(travelState.parse(value))
    },
    clearTravel: async () => travelState.parse(must(await db.rpc('travel_clear'))),
  }
}
