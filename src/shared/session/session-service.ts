import type { Role } from './roles'

/** Port: who is using the app. Mocked until Supabase Auth arrives in Block 5. */
export interface SessionService {
  getRoles(): Promise<readonly Role[]>
}
