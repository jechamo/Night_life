import type { Role } from './roles'

/** Port: who is using the app. Mocked until Supabase Auth arrives in Block 5. */
export interface SessionService {
  getRoles(): Promise<readonly Role[]>
  /** Ends the session on this device (the data stays on the server). */
  signOut(): Promise<void>
  /** Notifies sign-in/out and MFA changes so cached data is refetched. Returns unsubscribe. */
  onChange(listener: () => void): () => void
}
