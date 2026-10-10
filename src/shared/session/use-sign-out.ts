import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePlatform } from '@/platform'
import { useBiometricLock } from '@/shared/security/biometric-lock-context'
import { useServices } from '@/shared/services/ServicesProvider'

/**
 * Signs out on this device and drops every cached query (nothing personal remains).
 * The biometric lock belonged to that session, so it is switched off too, and the store
 * forgets the account so the next person cannot buy on its behalf (Block 11b).
 */
export function useSignOut() {
  const { session } = useServices()
  const { store } = usePlatform()
  const queryClient = useQueryClient()
  const biometricLock = useBiometricLock()
  return useMutation({
    mutationFn: () => session.signOut(),
    onSuccess: async () => {
      queryClient.clear()
      await Promise.all([biometricLock.reset(), store.logOut()])
    },
  })
}
