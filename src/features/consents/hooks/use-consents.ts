import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServices } from '@/shared/services/ServicesProvider'
import type { ConsentChoices } from '../model/consents'

export const consentsKey = ['consents', 'mine'] as const

export function useConsents() {
  const { consents } = useServices()
  return useQuery({ queryKey: consentsKey, queryFn: () => consents.getMine() })
}

export function useSaveConsents() {
  const { consents } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ choices, city }: { choices: ConsentChoices; city: string | null }) =>
      consents.save(choices, city),
    onSuccess: (state) => queryClient.setQueryData(consentsKey, state),
  })
}
