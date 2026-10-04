import { useSessionMutation } from '@/shared/session/use-session-mutation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServices } from '@/shared/services/ServicesProvider'
import type {
  ManagedVenue,
  SponsorshipTier,
  VenuePanelService,
} from '../services/venue-panel-service'

const venuesKey = ['venue-panel', 'venues'] as const

export function useCreateFlashAlert(placeId: string) {
  const { venuePanel } = useServices()
  return useSessionMutation({
    mutationFn: (input: Parameters<VenuePanelService['createFlashAlert']>[1]) =>
      venuePanel.createFlashAlert(placeId, input),
  })
}
export function useFlashAlerts(placeId: string, enabled: boolean) {
  const { venuePanel } = useServices()
  return useQuery({
    queryKey: ['flash-alerts', placeId],
    enabled,
    queryFn: () => venuePanel.flashAlerts(placeId),
    refetchInterval: 60000,
  })
}

export function useMyVenues() {
  const { venuePanel } = useServices()
  return useQuery({ queryKey: venuesKey, queryFn: () => venuePanel.myVenues() })
}

export function useVenueStats(placeId: string | undefined) {
  const { venuePanel } = useServices()
  return useQuery({
    queryKey: ['venue-panel', 'stats', placeId],
    queryFn: () => venuePanel.stats(placeId!),
    enabled: !!placeId,
  })
}

function useInvalidateVenues() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: venuesKey })
}

export function useClaimVenue() {
  const { venuePanel } = useServices()
  const invalidate = useInvalidateVenues()
  return useSessionMutation({
    mutationFn: ({ placeId, evidence }: { placeId: string; evidence: string }) =>
      venuePanel.claim(placeId, evidence),
    onSuccess: invalidate,
  })
}

export function useUpdateVenue() {
  const { venuePanel } = useServices()
  const queryClient = useQueryClient()
  return useSessionMutation({
    mutationFn: ({
      placeId,
      patch,
    }: {
      placeId: string
      patch: Partial<Pick<ManagedVenue, 'description' | 'hours' | 'price'>>
    }) => venuePanel.update(placeId, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venue-panel'] }),
  })
}

export function useRequestSponsorship() {
  const { venuePanel } = useServices()
  const invalidate = useInvalidateVenues()
  return useSessionMutation({
    mutationFn: ({
      placeId,
      tier,
      from,
      to,
    }: {
      placeId: string
      tier: SponsorshipTier
      from: string
      to: string
    }) => venuePanel.requestSponsorship(placeId, tier, from, to),
    onSuccess: invalidate,
  })
}

export function useCreateOfficialEvent() {
  const { venuePanel } = useServices()
  const queryClient = useQueryClient()
  return useSessionMutation({
    mutationFn: ({
      placeId,
      input,
    }: {
      placeId: string
      input: Parameters<VenuePanelService['createOfficialEvent']>[1]
    }) => venuePanel.createOfficialEvent(placeId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['places'] }),
  })
}
