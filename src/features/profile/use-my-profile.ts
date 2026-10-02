import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServices } from '@/shared/services/ServicesProvider'
import type { ProfilePatch } from './services/profile-service'

export const myProfileKey = ['profile', 'mine'] as const

export function useMyProfile() {
  const { profile } = useServices()
  return useQuery({ queryKey: myProfileKey, queryFn: () => profile.getMine() })
}

export function useUpdateProfile() {
  const { profile } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: ProfilePatch) => profile.update(patch),
    onSuccess: async (me) => {
      queryClient.setQueryData(myProfileKey, me)
      await queryClient.invalidateQueries({ queryKey: ['matching'] })
    },
  })
}
