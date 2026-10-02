import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServices } from '@/shared/services/ServicesProvider'
import type { Place, Vibe } from '../model/types'
import type { CreateEventInput, EventReportReason } from '../services/places-service'

export const placesKey = ['places'] as const
export const lostFoundKey = (placeId: string) => ['places', placeId, 'lost-found'] as const

export function usePlaces() {
  const { places } = useServices()
  return useQuery({ queryKey: placesKey, queryFn: () => places.list() })
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

/** Writes a fresh copy of one place into the list cache. */
export function useReplacePlace() {
  const queryClient = useQueryClient()
  return (place: Place) =>
    queryClient.setQueryData<Place[]>(placesKey, (list) =>
      list
        ? list.some((p) => p.id === place.id)
          ? list.map((p) => (p.id === place.id ? place : p))
          : [...list, place]
        : [place],
    )
}

export function useVoteVibe(placeId: string) {
  const { places } = useServices()
  const replace = useReplacePlace()
  const queryClient = useQueryClient()
  return useMutation({
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
  return useMutation({
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
  return useMutation({
    mutationFn: ({ placeId, reason }: { placeId: string; reason: EventReportReason }) =>
      places.reportEvent(placeId, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: placesKey }),
  })
}

export function useCreateEvent() {
  const { places } = useServices()
  const replace = useReplacePlace()
  return useMutation({
    mutationFn: (input: CreateEventInput) => places.createEvent(input),
    onSuccess: (result) => {
      if (result.ok) replace(result.value)
    },
  })
}
