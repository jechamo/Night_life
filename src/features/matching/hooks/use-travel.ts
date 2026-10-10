import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'
import { useServices } from '@/shared/services/ServicesProvider'
import { useSessionMutation } from '@/shared/session/use-session-mutation'

export const travelKey = ['matching', 'travel'] as const

/** Block 11b: travel mode state and actions; the deck is refetched after every change. */
export function useTravelMode() {
  const { matching } = useServices()
  const queryClient = useQueryClient()
  const enabled = useFeatureFlag('travel_mode_enabled') === 'on' && !!matching.travelState
  const state = useQuery({
    queryKey: travelKey,
    enabled,
    queryFn: () => matching.travelState!(),
  })
  const changed = async () => {
    await queryClient.invalidateQueries({ queryKey: travelKey })
    await queryClient.invalidateQueries({ queryKey: ['matching', 'candidates'] })
  }
  const start = useSessionMutation({
    mutationFn: ({ city, days }: { city: string; days: number }) => matching.setTravel!(city, days),
    onSuccess: changed,
  })
  const stop = useSessionMutation({ mutationFn: () => matching.clearTravel!(), onSuccess: changed })
  return { enabled, state, start, stop }
}
