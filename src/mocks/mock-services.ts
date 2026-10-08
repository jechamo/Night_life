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
import { createMockAttendanceService, createMockPlacesService } from './world/place-services'
import { createMockRealtime } from './world/realtime'
import {
  createMockChatService,
  createMockMatchingService,
  createMockProfileService,
} from './world/social-services'
import { createWorldState } from './world/world-state'
import { createMockDashboardService } from './world/dashboard-service'
import { hasEntitlement } from '@/shared/entitlements/entitlements'
import { createMockAdminService } from './backoffice/admin'
import { createMockConfig } from './backoffice/config'
import {
  createMockModerationService,
  createMockPrivacyService,
  createMockSafetyService,
  createMockVenuePanelService,
} from './backoffice/others'
import { createMockPremiumService } from './backoffice/premium'

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
  /** Fake realtime timers (off in tests). */
  realtime?: boolean
}

/**
 * The mock account holds every role so the owner can walk through every panel; the
 * admin can simulate other role sets (Admin → Herramientas de prueba).
 */
export const MOCK_ROLES: readonly Role[] = ['user', 'tester', 'venue_manager', 'admin']
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
  const config = createMockConfig(
    { ...INITIAL_FLAG_VALUES, verification_provider: 'simulator', ...options.flags },
    options.roles ?? MOCK_ROLES,
    options.entitlements ?? MOCK_ENTITLEMENTS,
  )
  const store = createMockStore(options.preferences ?? createMemoryPreferences(), options.state)
  const wait = () => latency(options.latencyMs ?? 350)
  const world = createWorldState()
  const realtime = options.realtime ?? true
  const unlimitedLikes = () =>
    config.flags.premium_enabled === 'on' &&
    hasEntitlement(config.entitlements, 'unlimited_likes', new Date())
  const premium = createMockPremiumService(config, wait, {
    isRedLight: (id) => world.people.find((p) => p.id === id)?.trafficLight === 'red',
  })
  return {
    dashboard: createMockDashboardService(world, store),
    premium,
    admin: createMockAdminService(config, world, store, premium, wait),
    venuePanel: createMockVenuePanelService(world, config, wait, store),
    privacy: createMockPrivacyService(world, store, config, wait),
    moderation: createMockModerationService(config, wait),
    safety: createMockSafetyService(wait),
    places: createMockPlacesService(world, store, wait, config),
    attendance: createMockAttendanceService(world, wait, {
      ignoreTonightWindow: () => config.flags.test_tools_enabled === 'on',
    }),
    matching: createMockMatchingService(world, wait, {
      unlimitedLikes,
      realtime,
      onReport: (report) => config.myReports.unshift(report),
    }),
    chat: createMockChatService(world, wait, { realtime }),
    profile: createMockProfileService(world, wait),
    realtime: createMockRealtime(world, realtime),
    onboarding: createMockOnboardingService(store, wait),
    legal: createMockLegalService(store, wait),
    consents: createMockConsentService(store, wait),
    verification: createMockVerificationService(store, wait),
    flags: createFlagService({ load: () => Promise.resolve({ ...config.flags }) }),
    session: {
      getGeneration: () => 0,
      getRoles: () => Promise.resolve([...config.roles]),
      signOut: async () => {
        await store.update((s) => ({ ...s, onboarded: false }))
      },
      onChange: () => () => undefined,
    },
    entitlements: { getMine: () => Promise.resolve([...config.entitlements]) },
  }
}
