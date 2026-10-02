import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useServices } from '@/shared/services/ServicesProvider'

/** Signs out on this device and drops every cached query (nothing personal remains). */
export function useSignOut() {
  const { session } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => session.signOut(),
    onSuccess: () => queryClient.clear(),
  })
}
