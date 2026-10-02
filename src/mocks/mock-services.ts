import type { Entitlement } from '@/shared/entitlements/entitlements'
import { createFlagService } from '@/shared/flags/flag-service'
import { INITIAL_FLAG_VALUES, type FeatureFlags } from '@/shared/flags/flags'
import type { AppServices } from '@/shared/services/services'
import type { Role } from '@/shared/session/roles'
import type { PreferencesService } from '@/platform/preferences/preferences'
import { createMemoryPreferences } from '@/platform/preferences/preferences.memory'
import {
  createMockConsentService,
  createMockLegalService,
  createMockOnboardingService,
  createMockVerificationService,
} from './mock-auth-services'
import { createMockStore, latency, type MockState } from './mock-store'

export interface MockServiceOptions {
  flags?: Partial<FeatureFlags>
  roles?: readonly Role[]
  entitlements?: readonly Entitlement[]
  /** Where the simulated backend keeps its (non-personal) state. */
  preferences?: PreferencesService
  /** Initial simulated state (e.g. already onboarded in tests). */
  state?: Partial<MockState>
  /** Artificial latency per call; 0 in tests. */
  latencyMs?: number
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
  const store = createMockStore(options.preferences ?? createMemoryPreferences(), options.state)
  const wait = () => latency(options.latencyMs ?? 350)
  return {
    onboarding: createMockOnboardingService(store, wait),
    legal: createMockLegalService(store, wait),
    consents: createMockConsentService(store, wait),
    verification: createMockVerificationService(store, wait),
    flags: createFlagService({ load: () => Promise.resolve(flags) }),
    session: { getRoles: () => Promise.resolve(options.roles ?? MOCK_ROLES) },
    entitlements: { getMine: () => Promise.resolve(options.entitlements ?? MOCK_ENTITLEMENTS) },
  }
}
