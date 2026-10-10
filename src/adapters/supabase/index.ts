import type { Platform } from '@/platform'
import { createFlagService } from '@/shared/flags/flag-service'
import type { AppServices } from '@/shared/services/services'
import { createAdminService } from './admin'
import { createPremiumService } from './billing'
import { createModerationService, createVenuePanelService } from './business'
import { withPersistedAgeGate } from './age-gated-services'
import { createAttendanceService } from './attendance'
import { createSupabaseClient } from './client'
import { createEntitlementService, createFlagSource, createSessionService } from './core-services'
import { createLegalService, startEmailOutbox } from './legal'
import { createOnboardingService } from './onboarding'
import { createPlacesService } from './places'
import { createTravelMethods } from './travel'
import { createDashboardService } from './dashboard'
import { createPrivacyService } from './privacy'
import { createConsentService, createProfileService, createSafetyService } from './profile'
import { createRealtimeService } from './realtime'
import { createChatService, createMatchingService } from './social'
import { createVerificationService } from './verification'

/**
 * Block 8 composition: persisted social services and private realtime alongside places.
 */
export function createSupabaseServices(
  config: { url: string; publishableKey: string },
  platform: Platform,
  simulated: AppServices,
): AppServices {
  const db = createSupabaseClient(config, platform.secureStorage)
  const verification = createVerificationService(db)
  startEmailOutbox(db, platform)
  const gated = withPersistedAgeGate(
    {
      ...simulated,
      places: createPlacesService(db),
      attendance: createAttendanceService(db),
      matching: { ...createMatchingService(db), ...createTravelMethods(db) },
      chat: createChatService(db),
      realtime: createRealtimeService(db),
    },
    verification,
  )
  return {
    ...simulated,
    ...gated,
    dashboard: createDashboardService(db),
    verification,
    flags: createFlagService(createFlagSource(db)),
    entitlements: createEntitlementService(db),
    session: createSessionService(db),
    onboarding: createOnboardingService(db, platform),
    legal: createLegalService(db),
    consents: createConsentService(db),
    profile: createProfileService(db),
    safety: createSafetyService(db),
    privacy: createPrivacyService(db),
    moderation: createModerationService(db, simulated.moderation),
    premium: createPremiumService(db),
    venuePanel: createVenuePanelService(db),
    admin: createAdminService(db, simulated.admin),
  }
}
