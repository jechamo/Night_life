import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useBiometricLock } from '@/shared/security/biometric-lock-context'
import { useServices } from '@/shared/services/ServicesProvider'

/**
 * Signs out on this device and drops every cached query (nothing personal remains).
 * The biometric lock belonged to that session, so it is switched off too.
 */
export function useSignOut() {
  const { session } = useServices()
  const queryClient = useQueryClient()
  const biometricLock = useBiometricLock()
  return useMutation({
    mutationFn: () => session.signOut(),
    onSuccess: async () => {
      queryClient.clear()
      await biometricLock.reset()
    },
  })
}
