import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'
import { useServices } from '@/shared/services/ServicesProvider'

/** Roadmap R4: signed URLs last 15 minutes; refresh well before they expire. */
const PHOTO_STALE_MS = 10 * 60_000

export const showcaseKey = (placeId: string) => ['places', placeId, 'showcase'] as const
export const coversKey = ['places', 'covers'] as const

export function useShowcaseEnabled() {
  return useFeatureFlag('venue_showcase_enabled') === 'on'
}

/** Photos, extra details and «Lo dice el local» of one venue (flag on only). */
export function useVenueShowcase(placeId: string, enabled: boolean) {
  const { places } = useServices()
  return useQuery({
    queryKey: showcaseKey(placeId),
    queryFn: () => places.showcase(placeId),
    enabled,
    staleTime: PHOTO_STALE_MS,
    refetchInterval: PHOTO_STALE_MS,
  })
}

/** Approved cover per venue. Without the flag nothing is requested. */
export function useVenueCover(placeId: string): string | undefined {
  const { places } = useServices()
  const enabled = useShowcaseEnabled()
  const { data } = useQuery({
    queryKey: coversKey,
    queryFn: () => places.covers(),
    enabled,
    staleTime: PHOTO_STALE_MS,
    refetchInterval: PHOTO_STALE_MS,
  })
  return enabled ? data?.[placeId] : undefined
}

/** Counts one view per venue page visit (the server keeps one per person and night). */
export function useTrackPlaceView(placeId: string, enabled: boolean) {
  const { places } = useServices()
  useEffect(() => {
    if (!enabled) return
    places.trackView(placeId).catch(() => undefined)
  }, [enabled, placeId, places])
}
