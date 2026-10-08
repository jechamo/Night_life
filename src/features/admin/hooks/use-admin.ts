import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FeatureFlags, FlagKey } from '@/shared/flags/flags'
import { useServices } from '@/shared/services/ServicesProvider'
import type { Role } from '@/shared/session/roles'
import type { ProviderQuotaChange } from '../model/provider-quota'
import type { CatalogueRow } from '../model/venue-csv'
import type { VenueInput } from '../model/venue'
import type { AdminSection, AdminService, AdminSetting, TestTool } from '../services/admin-service'
import type { ContractInput, PartnerInput } from '@/features/venue-panel/model/partners'
import type { PhotoStatus } from '@/features/places/model/showcase'

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
function useAdminMutation<A, R = unknown>(fn: (admin: AdminService, args: A) => Promise<R>) {
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

export function useProviderQuotas() {
  const { admin } = useServices()
  return useQuery({
    queryKey: [...adminKey, 'providers'],
    queryFn: () => admin.providerQuotas(),
    refetchInterval: 30_000,
  })
}

export const useConfigureProvider = () =>
  useAdminMutation((admin, change: ProviderQuotaChange) => admin.configureProvider(change))

export const useSetMapToken = () =>
  useAdminMutation((admin, token: string) => admin.setMapToken(token))

export function useAdminVenues(query = '') {
  const { admin } = useServices()
  return useQuery({
    queryKey: [...adminKey, 'venues', query],
    queryFn: () => admin.venues(query),
    placeholderData: keepPreviousData,
  })
}

export const useImportOsmVenues = () =>
  useAdminMutation((admin, city: string) => admin.importOsmVenues(city))

export const useImportCatalogue = () =>
  useAdminMutation((admin, rows: readonly CatalogueRow[]) => admin.importCatalogue(rows))

export const useDeleteVenue = () => useAdminMutation((admin, id: string) => admin.deleteVenue(id))

export const useSaveVenue = () =>
  useAdminMutation(async (admin, a: { id: string | null; input: VenueInput }) => {
    if (a.id) await admin.updateVenue(a.id, a.input)
    else await admin.createVenue(a.input)
  })

export const useSeedTestVenues = () =>
  useAdminMutation<void, number>((admin) => admin.seedTestVenues())

export const useFillTestVenue = () =>
  useAdminMutation((admin, a: { id: string; count: number }) => admin.fillTestVenue(a.id, a.count))

export const useImportTestEvents = () =>
  useAdminMutation((admin, a: { city: string; count: number }) =>
    admin.importTestEvents(a.city, a.count),
  )

export const useSetSimulatedRoles = () =>
  useAdminMutation((admin, roles: readonly Role[]) => admin.setSimulatedRoles(roles))

// Roadmap R3: partners, contracts, invitations and venue managers.
export function useAdminPartners() {
  const { admin } = useServices()
  return useQuery({ queryKey: [...adminKey, 'partners'], queryFn: () => admin.partners() })
}

export const useSavePartner = () =>
  useAdminMutation((admin, input: PartnerInput) => admin.savePartner(input))

export const useLinkPartnerVenue = () =>
  useAdminMutation((admin, a: { accountId: string; venueId: string; link: boolean }) =>
    admin.linkPartnerVenue(a.accountId, a.venueId, a.link),
  )

export const useCreateContract = () =>
  useAdminMutation((admin, input: ContractInput) => admin.createContract(input))

export const useContractAction = () =>
  useAdminMutation((admin, a: { id: string; action: 'activate' | 'end' }) =>
    admin.contractAction(a.id, a.action),
  )

export const useInviteVenueOwner = () =>
  useAdminMutation((admin, venueId: string) => admin.inviteVenueOwner(venueId))

export const useRevokeInvitation = () =>
  useAdminMutation((admin, id: string) => admin.revokeInvitation(id))

export const useRemoveVenueManager = () =>
  useAdminMutation((admin, a: { venueId: string; userId: string }) =>
    admin.removeManager(a.venueId, a.userId),
  )

// Roadmap R4: moderation of venue photos.
export function useAdminVenuePhotos(status: PhotoStatus) {
  const { admin } = useServices()
  return useQuery({
    queryKey: [...adminKey, 'venue-photos', status],
    queryFn: () => admin.venuePhotos(status),
  })
}

export const useReviewVenuePhoto = () =>
  useAdminMutation((admin, input: { photoId: string; approve: boolean; reason?: string }) =>
    admin.reviewVenuePhoto(input.photoId, input.approve, input.reason),
  )
