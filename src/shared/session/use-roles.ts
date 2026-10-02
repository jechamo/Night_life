import { useQuery } from '@tanstack/react-query'
import { useServices } from '@/shared/services/ServicesProvider'
import type { Role } from './roles'

const NO_ROLES: readonly Role[] = []
export const rolesQueryKey = ['session', 'roles'] as const

function useRolesQuery() {
  const { session } = useServices()
  return useQuery({ queryKey: rolesQueryKey, queryFn: () => session.getRoles() })
}

/** Current user's roles. Unknown/loading = no roles (fail closed). UI hint only: RLS decides. */
export function useRoles(): readonly Role[] {
  return useRolesQuery().data ?? NO_ROLES
}

/** Roles + loading flag, for route guards that must not redirect before roles arrive. */
export function useRolesState(): { roles: readonly Role[]; isPending: boolean } {
  const { data, isPending } = useRolesQuery()
  return { roles: data ?? NO_ROLES, isPending }
}
