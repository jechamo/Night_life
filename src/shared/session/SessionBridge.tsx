import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useServices } from '@/shared/services/ServicesProvider'

/**
 * Observer: when the user signs in/out or completes MFA, every cached query is
 * refetched (roles, flags audience, entitlements, profile…). No parallel state.
 */
export function SessionBridge() {
  const { session } = useServices()
  const queryClient = useQueryClient()
  useEffect(
    () => session.onChange(() => void queryClient.invalidateQueries()),
    [session, queryClient],
  )
  return null
}
