import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePlatform } from '@/platform'
import { useServices } from '@/shared/services/ServicesProvider'
import { beginSessionWork } from '@/shared/session/use-session-mutation'

const requestsKey = ['privacy', 'requests'] as const

export function useDataRequests() {
  const { privacy } = useServices()
  return useQuery({ queryKey: requestsKey, queryFn: () => privacy.requests() })
}

export function useRequestDataRight() {
  const { privacy } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (kind: 'rectify' | 'object' | 'restrict') => privacy.requestRight(kind),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: requestsKey }),
  })
}

/** GDPR art. 15/20: machine-readable export saved through the platform layer. */
export function useExportMyData() {
  const { privacy, session } = useServices()
  const { files } = usePlatform()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const check = beginSessionWork(session)
      const data = await privacy.exportMyData()
      check()
      return files.downloadJson(
        `nightlife-connect-${new Date().toISOString().slice(0, 10)}.json`,
        data,
      )
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: requestsKey }),
  })
}

export function useRequestDeletionCode() {
  const { privacy } = useServices()
  return useMutation({ mutationFn: () => privacy.requestDeletionCode() })
}

export function useDeleteAccount() {
  const { privacy } = useServices()
  return useMutation({ mutationFn: (otp: string) => privacy.deleteAccount(otp) })
}

export function useLogoutEverywhere() {
  const { privacy } = useServices()
  return useMutation({ mutationFn: () => privacy.logoutEverywhere() })
}
