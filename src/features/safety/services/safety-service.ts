export interface EmergencyContact {
  id: string
  name: string
  phone: string
}

/** SOS Lite (PRD 6.9): trusted contacts, private to the owner (RLS). */
export interface SafetyService {
  contacts(): Promise<EmergencyContact[]>
  saveContacts(contacts: readonly Omit<EmergencyContact, 'id'>[]): Promise<EmergencyContact[]>
}
