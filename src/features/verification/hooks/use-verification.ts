import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { usePlatform } from '@/platform'
import { useServices } from '@/shared/services/ServicesProvider'
import type { AgeMethod, VerificationLevel } from '../model/verification'
import type { SandboxOutcome } from '../services/verification-service'

export const verificationKey = ['verification', 'snapshot'] as const

export function useVerificationSnapshot() {
  const { verification } = useServices()
  return useQuery({ queryKey: verificationKey, queryFn: () => verification.getSnapshot() })
}

/** Starts a provider flow and follows the redirect (external via the platform browser). */
export function useStartVerification() {
  const { verification } = useServices()
  const { browser } = usePlatform()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ level, method }: { level: VerificationLevel; method?: AgeMethod }) => {
      const result = await verification.start(level, method)
      if (!result.ok) throw new Error(result.error)
      return result.value
    },
    onSuccess: async (redirect) => {
      await queryClient.invalidateQueries({ queryKey: verificationKey })
      if (redirect.type === 'internal') await navigate(redirect.path)
      else await browser.openExternalFlow(redirect.url)
    },
  })
}

export function useRequestHumanReview() {
  const { verification } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (level: VerificationLevel) => verification.requestHumanReview(level),
    onSuccess: (snapshot) => queryClient.setQueryData(verificationKey, snapshot),
  })
}

export function useSimulateVerification() {
  const { verification } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ level, outcome }: { level: VerificationLevel; outcome: SandboxOutcome }) =>
      verification.simulateResult(level, outcome),
    onSuccess: (snapshot) => queryClient.setQueryData(verificationKey, snapshot),
  })
}
