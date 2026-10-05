import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVerificationSnapshot } from '@/features/verification/hooks/use-verification'
import { isAgeVerified } from '@/features/verification/model/verification'
import { useServices } from '@/shared/services/ServicesProvider'
import { useSessionMutation } from '@/shared/session/use-session-mutation'
import { premiumKey } from './use-premium'

export const socialPremiumKey = ['premium', 'social'] as const
export function useSocialPremium() {
  const { premium } = useServices()
  const { data: verification } = useVerificationSnapshot()
  return useQuery({
    queryKey: socialPremiumKey,
    queryFn: () => premium.getSocialState!(),
    enabled: !!premium.getSocialState && !!verification && isAgeVerified(verification),
    refetchInterval: 30000,
  })
}
export function useSocialPremiumActions() {
  const { premium } = useServices()
  const queryClient = useQueryClient()
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: premiumKey }),
      queryClient.invalidateQueries({ queryKey: socialPremiumKey }),
      queryClient.invalidateQueries({ queryKey: ['matching'] }),
    ])
  }
  return {
    spark: useSessionMutation({
      mutationFn: (personId: string) => premium.sendSpark!(personId),
      onSuccess: refresh,
    }),
    spotlight: useSessionMutation({
      mutationFn: (placeId: string | null) => premium.activateSpotlight!(placeId),
      onSuccess: refresh,
    }),
    incognito: useSessionMutation({
      mutationFn: (on: boolean) => premium.setIncognito!(on),
      onSuccess: refresh,
    }),
    seen: useSessionMutation({ mutationFn: () => premium.markSparksSeen!(), onSuccess: refresh }),
  }
}
