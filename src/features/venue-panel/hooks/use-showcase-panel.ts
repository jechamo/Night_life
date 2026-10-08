import { useQuery, useQueryClient } from '@tanstack/react-query'
import { coversKey, showcaseKey } from '@/features/places/hooks/use-showcase'
import type {
  DoorState,
  NoticeKind,
  OfferKind,
  VenueExtras,
  VenueNotice,
  VenuePhotos,
} from '@/features/places/model/showcase'
import { usePlatform } from '@/platform'
import { useServices } from '@/shared/services/ServicesProvider'
import { useSessionMutation } from '@/shared/session/use-session-mutation'

// Roadmap R4 (flag `venue_showcase_enabled`, checked by the server).
const photosKey = (placeId: string) => ['venue-panel', 'photos', placeId] as const
const reportKey = (placeId: string) => ['venue-panel', 'report', placeId] as const

export function useVenuePhotos(placeId: string, enabled: boolean) {
  const { venuePanel } = useServices()
  return useQuery({
    queryKey: photosKey(placeId),
    queryFn: () => venuePanel.photos(placeId),
    enabled,
    staleTime: 10 * 60_000,
  })
}

/** After any photo change: the panel list, the public page and the covers. */
function usePhotosChanged(placeId: string) {
  const queryClient = useQueryClient()
  return (photos: VenuePhotos) => {
    queryClient.setQueryData(photosKey(placeId), photos)
    void queryClient.invalidateQueries({ queryKey: showcaseKey(placeId) })
    void queryClient.invalidateQueries({ queryKey: coversKey })
  }
}

export type UploadError = 'photo_limit' | 'unsupported_type' | 'too_large' | 'decode_failed'

/** Picks a photo, re-encodes it on the device (no EXIF/GPS) and uploads it as pending. */
export function useUploadVenuePhoto(placeId: string) {
  const { venuePanel } = useServices()
  const { camera, images } = usePlatform()
  const changed = usePhotosChanged(placeId)
  return useSessionMutation({
    mutationFn: async (): Promise<VenuePhotos | null> => {
      const picked = await camera.pickPhoto('gallery')
      if (!picked.ok) return null
      const clean = await images.sanitize(picked.value)
      if (!clean.ok) throw new Error(clean.error)
      const result = await venuePanel.uploadPhoto(placeId, clean.value)
      if (!result.ok) throw new Error(result.error)
      return result.value
    },
    onSuccess: (photos) => {
      if (photos) changed(photos)
    },
  })
}

export function useRemoveVenuePhoto(placeId: string) {
  const { venuePanel } = useServices()
  const changed = usePhotosChanged(placeId)
  return useSessionMutation({
    mutationFn: (photoId: string) => venuePanel.removePhoto(placeId, photoId),
    onSuccess: changed,
  })
}

export function useSetCoverPhoto(placeId: string) {
  const { venuePanel } = useServices()
  const changed = usePhotosChanged(placeId)
  return useSessionMutation({
    mutationFn: (photoId: string) => venuePanel.setCoverPhoto(placeId, photoId),
    onSuccess: changed,
  })
}

export function useSaveVenueExtras(placeId: string) {
  const { venuePanel } = useServices()
  const queryClient = useQueryClient()
  return useSessionMutation({
    mutationFn: (extras: VenueExtras) => venuePanel.saveExtras(placeId, extras),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: showcaseKey(placeId) }),
  })
}

type NoticeInput = { kind: 'door'; value: DoorState } | { kind: OfferKind; until: string }

export function useSetVenueNotice(placeId: string) {
  const { venuePanel } = useServices()
  const queryClient = useQueryClient()
  return useSessionMutation({
    mutationFn: (input: NoticeInput | { clear: NoticeKind }): Promise<VenueNotice[]> =>
      'clear' in input
        ? venuePanel.clearNotice(placeId, input.clear)
        : venuePanel.setNotice(placeId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: showcaseKey(placeId) }),
  })
}

export function useVenueReport(placeId: string, enabled: boolean) {
  const { venuePanel } = useServices()
  return useQuery({
    queryKey: reportKey(placeId),
    queryFn: () => venuePanel.report(placeId),
    enabled,
  })
}
