import type { EntitlementService } from '@/shared/entitlements/entitlement-service'
import type { FlagService } from '@/shared/flags/flag-service'
import type { SessionService } from '@/shared/session/session-service'

/**
 * Service container (dependency injection). Blocks 1-4 inject mocks from
 * src/mocks; Block 5 swaps in Supabase-backed services without touching hooks/UI.
 */
export interface AppServices {
  flags: FlagService
  entitlements: EntitlementService
  session: SessionService
}
