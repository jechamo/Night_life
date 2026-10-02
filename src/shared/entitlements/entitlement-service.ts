import type { Entitlement } from './entitlements'

/** Port: the current user's entitlements (mock now, `entitlements` table from Block 5). */
export interface EntitlementService {
  getMine(): Promise<readonly Entitlement[]>
}
