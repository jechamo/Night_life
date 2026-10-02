import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServices } from '@/shared/services/ServicesProvider'
import type { ModerationService } from '../services/moderation-service'

export const accountStatusKey = ['moderation', 'account-status'] as const
const reportsKey = ['moderation', 'my-reports'] as const
const decisionsKey = ['moderation', 'decisions'] as const

export function useAccountStatus() {
  const { moderation } = useServices()
  return useQuery({ queryKey: accountStatusKey, queryFn: () => moderation.accountStatus() })
}

export function useMyReports() {
  const { moderation } = useServices()
  return useQuery({ queryKey: reportsKey, queryFn: () => moderation.myReports() })
}

export function useDecisions() {
  const { moderation } = useServices()
  return useQuery({ queryKey: decisionsKey, queryFn: () => moderation.decisions() })
}

export function useAppeal() {
  const { moderation } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ decisionId, text }: { decisionId: string; text: string }) =>
      moderation.appeal(decisionId, text),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: decisionsKey }),
  })
}

/** Public DSA notice (no login needed). */
export function useIllegalContentNotice() {
  const { moderation } = useServices()
  return useMutation({
    mutationFn: (input: Parameters<ModerationService['submitIllegalContentNotice']>[0]) =>
      moderation.submitIllegalContentNotice(input),
  })
}
