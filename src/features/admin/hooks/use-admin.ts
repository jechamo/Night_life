import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FeatureFlags, FlagKey } from '@/shared/flags/flags'
import { useServices } from '@/shared/services/ServicesProvider'
import type { Role } from '@/shared/session/roles'
import type { AdminSection, AdminService, AdminSetting, TestTool } from '../services/admin-service'

const adminKey = ['admin'] as const
export const mfaKey = ['admin', 'mfa'] as const

export function useAdminDashboard() {
  const { admin } = useServices()
  return useQuery({ queryKey: [...adminKey, 'dashboard'], queryFn: () => admin.dashboard() })
}

export function useAdminList(section: AdminSection) {
  const { admin } = useServices()
  return useQuery({ queryKey: [...adminKey, 'list', section], queryFn: () => admin.list(section) })
}

export function useAdminSettings() {
  const { admin } = useServices()
  return useQuery({ queryKey: [...adminKey, 'settings'], queryFn: () => admin.settings() })
}

/** Second factor of this session (TOTP; `aal2` on the server). Enrol once, verify per session. */
export function useMfaSession() {
  const queryClient = useQueryClient()
  const { admin } = useServices()
  const status = useQuery({
    queryKey: mfaKey,
    queryFn: () => admin.mfaStatus(),
    staleTime: Infinity,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: mfaKey })
  const verify = useMutation({
    mutationFn: (code: string) => admin.verifyMfa(code),
    onSuccess: refresh,
  })
  const enroll = useMutation({ mutationFn: () => admin.enrollMfa() })
  return {
    pending: status.isPending,
    enrolled: status.data?.enrolled ?? false,
    verified: status.data?.verified ?? false,
    mode: admin.mode,
    verify,
    enroll,
  }
}

/** Admin writes touch many readers (flags, entitlements, places...): refresh broadly. */
function useAdminMutation<A>(fn: (admin: AdminService, args: A) => Promise<unknown>) {
  const { admin } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: A) => fn(admin, args),
    onSuccess: async () => {
      const mfa = queryClient.getQueryData(mfaKey)
      await queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] !== 'admin' || q.queryKey[1] !== 'mfa',
      })
      queryClient.setQueryData(mfaKey, mfa)
    },
  })
}

export const useAdminAct = () =>
  useAdminMutation(
    (admin, a: { section: AdminSection; id: string; action: string; note?: string }) =>
      admin.act(a.section, a.id, a.action, a.note),
  )

export type FlagChange = { [K in FlagKey]: { key: K; value: FeatureFlags[K] } }[FlagKey]

export const useSetFlag = () =>
  useAdminMutation((admin, a: FlagChange) => admin.setFlag<FlagKey>(a.key, a.value))

export const useSetSetting = () =>
  useAdminMutation((admin, a: { key: AdminSetting['key']; value: number }) =>
    admin.setSetting(a.key, a.value),
  )

export const useCreatePromoCode = () =>
  useAdminMutation((admin, a: Parameters<AdminService['createPromoCode']>[0]) =>
    admin.createPromoCode(a),
  )

export const useGrantEntitlement = () =>
  useAdminMutation((admin, a: Parameters<AdminService['grantEntitlement']>[0]) =>
    admin.grantEntitlement(a),
  )

export const useRunTestTool = () =>
  useAdminMutation((admin, tool: TestTool) => admin.runTestTool(tool))

export const useSetSimulatedRoles = () =>
  useAdminMutation((admin, roles: readonly Role[]) => admin.setSimulatedRoles(roles))
