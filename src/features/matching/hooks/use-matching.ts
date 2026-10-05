import { useSessionMutation } from '@/shared/session/use-session-mutation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEntitlement } from '@/shared/entitlements/use-entitlement'
import { useServices } from '@/shared/services/ServicesProvider'
import { likesRemaining, rankCandidates } from '../model/matching'
import type { ReportReason } from '../services/matching-service'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'

export function useSponsoredCards(placeId: string | null) {
  const { matching } = useServices()
  const enabled = useFeatureFlag('sponsored_cards_enabled') === 'on'
  const { granted } = useEntitlement('no_sponsored_cards')
  const query = useQuery({
    queryKey: ['matching', 'sponsors', placeId],
    queryFn: () => matching.sponsoredCards!(placeId),
    enabled: enabled && !granted && !!matching.sponsoredCards,
  })
  return { ...query, data: !enabled || granted ? [] : query.data }
}

export const matchesKey = ['matching', 'matches'] as const

export function useCandidates(placeId: string | null, onlyVerified: boolean) {
  const { matching } = useServices()
  return useQuery({
    queryKey: ['matching', 'candidates', placeId],
    queryFn: () => matching.candidates(placeId),
    select: (list) => rankCandidates(list, onlyVerified),
    staleTime: 30_000,
  })
}

export function useLikesLeft() {
  const { matching } = useServices()
  const unlimited = useEntitlement('unlimited_likes').granted
  const { data: used = 0 } = useQuery({
    queryKey: ['matching', 'likes-used'],
    queryFn: () => matching.likesUsedToday(),
  })
  const { data: status } = useQuery({
    queryKey: ['matching', 'like-status'],
    queryFn: () => matching.likeStatus!(),
    enabled: !!matching.likeStatus,
  })
  return {
    remaining: likesRemaining(
      status?.usedToday ?? used,
      status?.unlimited ?? unlimited,
      status?.limit,
    ),
    unlimited: status?.unlimited ?? unlimited,
  }
}

export function useSwipeActions() {
  const { matching } = useServices()
  const queryClient = useQueryClient()
  const like = useSessionMutation({
    mutationFn: (personId: string) => matching.like(personId),
    onSuccess: async (result) => {
      if (result.ok) queryClient.setQueryData(['matching', 'likes-used'], result.value.usedToday)
      void queryClient.invalidateQueries({ queryKey: ['matching', 'like-status'] })
      if (result.ok && result.value.match)
        await queryClient.invalidateQueries({ queryKey: matchesKey })
    },
  })
  const pass = useSessionMutation({ mutationFn: (personId: string) => matching.pass(personId) })
  const undo = useSessionMutation({
    mutationFn: () => matching.undo(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['matching', 'candidates'] }),
  })
  return { like, pass, undo }
}

export function useLikesYou() {
  const { matching } = useServices()
  return useQuery({ queryKey: ['matching', 'likes-you'], queryFn: () => matching.likesYou() })
}

export function useLikesYouCount() {
  const { matching } = useServices()
  return useQuery({
    queryKey: ['matching', 'likes-you-count'],
    queryFn: () =>
      matching.likesYouCount ? matching.likesYouCount() : matching.likesYou().then((p) => p.length),
  })
}

export function useMatches(enabled = true) {
  const { matching } = useServices()
  return useQuery({ queryKey: matchesKey, queryFn: () => matching.matches(), enabled })
}

export function usePerson(personId: string) {
  const { matching } = useServices()
  return useQuery({
    queryKey: ['matching', 'person', personId],
    queryFn: () => matching.person(personId),
  })
}

export function useSafetyActions() {
  const { matching } = useServices()
  const queryClient = useQueryClient()
  const refresh = () =>
    queryClient
      .invalidateQueries({ queryKey: ['matching'] })
      .then(() => queryClient.invalidateQueries({ queryKey: ['chat'] }))
  return {
    unmatch: useSessionMutation({
      mutationFn: (matchId: string) => matching.unmatch(matchId),
      onSuccess: refresh,
    }),
    block: useSessionMutation({
      mutationFn: (personId: string) => matching.block(personId),
      onSuccess: refresh,
    }),
    report: useSessionMutation({
      mutationFn: ({
        personId,
        reason,
        comment,
      }: {
        personId: string
        reason: ReportReason
        comment: string
      }) => matching.report(personId, reason, comment),
    }),
  }
}
