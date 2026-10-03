import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { usePlatform } from '@/platform'
import { useServices } from '@/shared/services/ServicesProvider'
import type { AgeMethod, VerificationLevel } from '../model/verification'
import type { SandboxOutcome } from '../services/verification-service'

export const verificationKey = ['verification', 'snapshot'] as const

export function useVerificationSnapshot() {
  const { verification } = useServices()
  const query = useQuery({
    queryKey: verificationKey,
    queryFn: () => verification.getSnapshot(),
    staleTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: 'always',
    retry: false,
  })
  // A failed refresh must not keep a formerly verified snapshot usable.
  return { ...query, data: query.isError ? undefined : query.data }
}

/** Starts a provider flow and follows the redirect (external via the platform browser). */
export function useStartVerification() {
  const { verification } = useServices()
  const { browser } = usePlatform()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      level,
      method,
      consent,
    }: {
      level: VerificationLevel
      method?: AgeMethod
      consent?: boolean
    }) => {
      const result = await verification.start(level, method, consent)
      if (!result.ok) throw new Error(result.error)
      if (result.value.type === 'external') {
        const opened = await browser.openExternalFlow(result.value.url)
        if (!opened.ok) throw new Error('unavailable')
      }
      return result.value
    },
    onSuccess: async (redirect) => {
      await queryClient.invalidateQueries({ queryKey: verificationKey })
      if (redirect.type === 'internal') await navigate(redirect.path)
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
