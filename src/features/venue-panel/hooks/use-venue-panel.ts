import { useSessionMutation } from '@/shared/session/use-session-mutation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { liveStatusKey } from '@/features/places/hooks/use-places'
import type { MusicGenre } from '@/features/places/model/live-status'
import { useServices } from '@/shared/services/ServicesProvider'
import type {
  ManagedVenue,
  SponsorshipTier,
  VenuePanelService,
} from '../services/venue-panel-service'

const venuesKey = ['venue-panel', 'venues'] as const
export function useVenueBilling(placeId: string) {
  const { venuePanel } = useServices()
  return useQuery({
    queryKey: ['venue-panel', 'billing', placeId],
    queryFn: () => venuePanel.billingState!(placeId),
    enabled: !!venuePanel.billingState,
  })
}

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

/** Roadmap R2: the venue declares up to 3 music styles and tonight's line-up. */
export function useSetVenueMusic(placeId: string) {
  const { venuePanel } = useServices()
  const queryClient = useQueryClient()
  return useSessionMutation({
    mutationFn: ({ genres, lineup }: { genres: MusicGenre[]; lineup: string }) =>
      venuePanel.setMusic(placeId, genres, lineup),
    onSuccess: (status) => {
      queryClient.setQueryData(liveStatusKey(placeId), status)
      void queryClient.invalidateQueries({ queryKey: ['places'] })
    },
  })
}

// Roadmap R3 (flag `venue_partners_enabled`).
const partnerKey = (placeId: string) => ['venue-panel', 'partner', placeId] as const
const teamKey = (placeId: string) => ['venue-panel', 'team', placeId] as const

export function useVenuePartnerState(placeId: string, enabled: boolean) {
  const { venuePanel } = useServices()
  return useQuery({
    queryKey: partnerKey(placeId),
    queryFn: () => venuePanel.partnerState(placeId),
    enabled,
  })
}

export function useVenueTeam(placeId: string, enabled: boolean) {
  const { venuePanel } = useServices()
  return useQuery({
    queryKey: teamKey(placeId),
    queryFn: () => venuePanel.team(placeId),
    enabled,
  })
}

function useInvalidateTeam(placeId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: teamKey(placeId) })
}

export function useInviteStaff(placeId: string) {
  const { venuePanel } = useServices()
  const invalidate = useInvalidateTeam(placeId)
  return useSessionMutation({
    mutationFn: () => venuePanel.inviteStaff(placeId),
    onSuccess: () => void invalidate(),
  })
}

export function useCancelStaffInvite(placeId: string) {
  const { venuePanel } = useServices()
  const invalidate = useInvalidateTeam(placeId)
  return useSessionMutation({
    mutationFn: (inviteId: string) => venuePanel.cancelInvite(placeId, inviteId),
    onSuccess: () => void invalidate(),
  })
}

export function useRemoveStaff(placeId: string) {
  const { venuePanel } = useServices()
  const invalidate = useInvalidateTeam(placeId)
  return useSessionMutation({
    mutationFn: (userId: string) => venuePanel.removeManager(placeId, userId),
    onSuccess: () => void invalidate(),
  })
}

export function useInvitePreview(code: string, enabled: boolean) {
  const { venuePanel } = useServices()
  return useQuery({
    queryKey: ['venue-panel', 'invite', code],
    queryFn: () => venuePanel.previewInvite(code),
    enabled,
    retry: false,
  })
}

export function useRedeemInvite() {
  const { venuePanel } = useServices()
  const queryClient = useQueryClient()
  return useSessionMutation({
    mutationFn: ({ code, acceptTerms }: { code: string; acceptTerms: boolean }) =>
      venuePanel.redeemInvite(code, acceptTerms),
    onSuccess: async (result) => {
      if (!result.ok) return
      // The new venue must be loaded before its page opens (a cached list would bounce back).
      queryClient.removeQueries({ queryKey: venuesKey })
      await queryClient.invalidateQueries()
    },
  })
}
