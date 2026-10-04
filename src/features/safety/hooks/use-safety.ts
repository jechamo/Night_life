import { useSessionMutation } from '@/shared/session/use-session-mutation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServices } from '@/shared/services/ServicesProvider'
import type { EmergencyContact } from '../services/safety-service'

const contactsKey = ['safety', 'contacts'] as const

export function useEmergencyContacts() {
  const { safety } = useServices()
  return useQuery({ queryKey: contactsKey, queryFn: () => safety.contacts() })
}

export function useSaveEmergencyContacts() {
  const { safety } = useServices()
  const queryClient = useQueryClient()
  return useSessionMutation({
    mutationFn: (contacts: readonly Omit<EmergencyContact, 'id'>[]) =>
      safety.saveContacts(contacts),
    onSuccess: (saved) => queryClient.setQueryData(contactsKey, saved),
  })
}
