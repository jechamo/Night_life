import type { Entitlement } from '@/shared/entitlements/entitlements'
import { createFlagService } from '@/shared/flags/flag-service'
import { INITIAL_FLAG_VALUES, type FeatureFlags } from '@/shared/flags/flags'
import type { AppServices } from '@/shared/services/services'
import type { Role } from '@/shared/session/roles'

export interface MockServiceOptions {
  flags?: Partial<FeatureFlags>
  roles?: readonly Role[]
  entitlements?: readonly Entitlement[]
}

/** A tester account with one tester-granted advantage, as in the PRD testing mode (6.14). */
export const MOCK_ROLES: readonly Role[] = ['user', 'tester']
export const MOCK_ENTITLEMENTS: readonly Entitlement[] = [
  {
    key: 'see_likes',
    source: 'tester',
    status: 'active',
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: null,
  },
]

export function createMockServices(options: MockServiceOptions = {}): AppServices {
  const flags = { ...INITIAL_FLAG_VALUES, ...options.flags }
  return {
    flags: createFlagService({ load: () => Promise.resolve(flags) }),
    session: { getRoles: () => Promise.resolve(options.roles ?? MOCK_ROLES) },
    entitlements: { getMine: () => Promise.resolve(options.entitlements ?? MOCK_ENTITLEMENTS) },
  }
}
