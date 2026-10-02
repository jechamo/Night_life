import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServices } from '@/shared/services/ServicesProvider'
import type { OnboardingData } from '../model/onboarding-machine'

export const onboardingStatusKey = ['onboarding', 'status'] as const

export function useOnboardingStatus() {
  const { onboarding } = useServices()
  return useQuery({ queryKey: onboardingStatusKey, queryFn: () => onboarding.getStatus() })
}

export function useCompleteOnboarding() {
  const { onboarding } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: OnboardingData) => onboarding.complete(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: onboardingStatusKey }),
  })
}

export function useResetOnboarding() {
  const { onboarding } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => onboarding.reset(),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
