import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useServices } from '@/shared/services/ServicesProvider'

/**
 * Observer: when the user signs in/out or completes MFA, every cached query is
 * reset before refetching (roles, flags, verification, profile…). Cached private
 * data from the previous account must not survive an identity change.
 */
export function SessionBridge() {
  const { session } = useServices()
  const queryClient = useQueryClient()
  useEffect(() => session.onChange(() => void queryClient.resetQueries()), [session, queryClient])
  return null
}
