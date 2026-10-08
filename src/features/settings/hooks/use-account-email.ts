import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServices } from '@/shared/services/ServicesProvider'

const KEY = ['account-email'] as const

/** Email of the signed-in account (roadmap R1: sign in with an email code). */
export function useAccountEmail() {
  const { onboarding } = useServices()
  return useQuery({ queryKey: KEY, queryFn: () => onboarding.getAccountEmail() })
}

export function useChangeEmail() {
  const { onboarding } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (email: string) => onboarding.changeEmail(email),
    onSuccess: (result) => {
      if (result.ok) void queryClient.invalidateQueries({ queryKey: KEY })
    },
  })
}
