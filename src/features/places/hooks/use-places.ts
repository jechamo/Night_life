import { useSessionMutation } from '@/shared/session/use-session-mutation'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useConsents } from '@/features/consents/hooks/use-consents'
import { usePlatform } from '@/platform'
import { useServices } from '@/shared/services/ServicesProvider'
import type { LatLng, Place, Vibe } from '../model/types'
import type { CreateEventInput, EventReportReason, MapAccess } from '../services/places-service'

export const placesKey = ['places'] as const
/** Every cached list of places, whatever area it was loaded for. */
export const placesListKey = ['places', 'list'] as const
export const lostFoundKey = (placeId: string) => ['places', placeId, 'lost-found'] as const

/** ~2 km grid: small pans reuse the cached list instead of searching again. */
const AREA_STEP = 0.02
/** Map viewport state shared with screens without a map (not server data). */
let area: LatLng | null = null
const areaListeners = new Set<() => void>()

const snap = (value: number) => Number((Math.round(value / AREA_STEP) * AREA_STEP).toFixed(4))

function setPlacesArea(lat: number, lng: number) {
  if (area?.lat === lat && area.lng === lng) return
  area = { lat, lng }
  areaListeners.forEach((listener) => listener())
}

function usePlacesArea(): LatLng | null {
  return useSyncExternalStore(
    (listener) => {
      areaListeners.add(listener)
      return () => areaListeners.delete(listener)
    },
    () => area,
  )
}

/**
 * Venues around `focus` (the map's area: the catalogue holds thousands per city) plus
 * live events. Without focus, the last area the map looked at is reused.
 */
export function usePlaces(focus?: LatLng | null) {
  const { places } = useServices()
  const stored = usePlacesArea()
  const lat = focus ? snap(focus.lat) : (stored?.lat ?? null)
  const lng = focus ? snap(focus.lng) : (stored?.lng ?? null)
  const focused = focus != null
  useEffect(() => {
    if (focused && lat !== null && lng !== null) setPlacesArea(lat, lng)
  }, [focused, lat, lng])
  return useQuery({
    queryKey: [...placesListKey, lat, lng],
    queryFn: () => places.list(lat !== null && lng !== null ? { lat, lng } : undefined),
    placeholderData: keepPreviousData,
  })
}

/**
 * Reserves one Mapbox load per mounted map (ADR 0010). Deliberately outside the query
 * cache: a broad invalidation must never reserve (and bill) another load.
 */
export function useMapAccess(): MapAccess | undefined {
  const { places } = useServices()
  const [access, setAccess] = useState<MapAccess>()
  const requested = useRef(false)
  useEffect(() => {
    if (requested.current) return
    requested.current = true
    places
      .reserveMapLoad()
      .then(setAccess, () => setAccess({ granted: false, reason: 'unavailable' }))
  }, [places])
  return access
}

/**
 * Foreground position for the "you are here" dot, only with the precise-location consent
 * (PRD 6.1). The coordinates stay on the device; without consent the chosen city is used.
 */
export function useMyPosition() {
  const { geolocation } = usePlatform()
  const { data: consents } = useConsents()
  const allowed = consents?.choices.precise_location === true
  const { data: position = null } = useQuery({
    queryKey: ['device', 'position'],
    enabled: allowed,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<LatLng | null> => {
      const result = await geolocation.getCurrentPosition({ timeoutMs: 8000 })
      return result.ok ? { lat: result.value.latitude, lng: result.value.longitude } : null
    },
  })
  return { position: allowed ? position : null, city: consents?.city ?? null }
}

export function usePlace(id: string | null): Place | undefined {
  const { data } = usePlaces()
  return id ? data?.find((p) => p.id === id) : undefined
}

export function useMyVibe(placeId: string) {
  const { places } = useServices()
  return useQuery({
    queryKey: ['places', placeId, 'my-vibe'],
    queryFn: () => places.myVibe(placeId),
  })
}

/** Writes a fresh copy of one place into every cached list. */
export function useReplacePlace() {
  const queryClient = useQueryClient()
  return (place: Place) =>
    queryClient.setQueriesData<Place[]>({ queryKey: placesListKey }, (list) =>
      list
        ? list.some((p) => p.id === place.id)
          ? list.map((p) => (p.id === place.id ? place : p))
          : [...list, place]
        : list,
    )
}

export function useVoteVibe(placeId: string) {
  const { places } = useServices()
  const replace = useReplacePlace()
  const queryClient = useQueryClient()
  return useSessionMutation({
    mutationFn: async (vibe: Vibe) => {
      const result = await places.voteVibe(placeId, vibe)
      if (!result.ok) throw new Error(result.error)
      return result.value
    },
    onSuccess: (place, vibe) => {
      replace(place)
      queryClient.setQueryData(['places', placeId, 'my-vibe'], vibe)
    },
  })
}

export function useConfirmEvent() {
  const { places } = useServices()
  const replace = useReplacePlace()
  return useSessionMutation({
    mutationFn: async (placeId: string) => {
      const result = await places.confirmEvent(placeId)
      if (!result.ok) throw new Error(result.error)
      return result.value
    },
    onSuccess: replace,
  })
}

export function useReportEvent() {
  const { places } = useServices()
  const queryClient = useQueryClient()
  return useSessionMutation({
    mutationFn: ({ placeId, reason }: { placeId: string; reason: EventReportReason }) =>
      places.reportEvent(placeId, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: placesKey }),
  })
}

export function useCreateEvent() {
  const { places } = useServices()
  const replace = useReplacePlace()
  return useSessionMutation({
    mutationFn: (input: CreateEventInput) => places.createEvent(input),
    onSuccess: (result) => {
      if (result.ok) replace(result.value)
    },
  })
}
