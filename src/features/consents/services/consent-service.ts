import type { ConsentChoices, ConsentKey } from '../model/consents'

export interface ConsentState {
  choices: ConsentChoices
  /** City chosen to explore when precise location is not granted. */
  city: string | null
  /** ISO timestamps of the last change per consent (evidence lives server-side). */
  updatedAt: Partial<Record<ConsentKey, string>>
}

/** Port: consents are append-only records server-side; revoking is as easy as granting. */
export interface ConsentService {
  getMine(): Promise<ConsentState>
  save(choices: ConsentChoices, city: string | null): Promise<ConsentState>
}
