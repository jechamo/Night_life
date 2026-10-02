import { useQuery } from '@tanstack/react-query'
import { useServices } from '@/shared/services/ServicesProvider'
import type { Role } from './roles'

const NO_ROLES: readonly Role[] = []

/** Current user's roles. Unknown/loading = no roles (fail closed). UI hint only: RLS decides. */
export function useRoles(): readonly Role[] {
  const { session } = useServices()
  const { data } = useQuery({ queryKey: ['session', 'roles'], queryFn: () => session.getRoles() })
  return data ?? NO_ROLES
}
