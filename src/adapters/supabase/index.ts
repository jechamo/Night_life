import type { Platform } from '@/platform'
import { createFlagService } from '@/shared/flags/flag-service'
import type { AppServices } from '@/shared/services/services'
import { createAdminService } from './admin'
import { withPersistedAgeGate } from './age-gated-services'
import { createAttendanceService } from './attendance'
import { createSupabaseClient } from './client'
import { createEntitlementService, createFlagSource, createSessionService } from './core-services'
import { createLegalService, startEmailOutbox } from './legal'
import { createOnboardingService } from './onboarding'
import { createPlacesService } from './places'
import { createPrivacyService, withRealAccountStatus } from './privacy'
import { createConsentService, createProfileService, createSafetyService } from './profile'
import { createRealtimeService, mergeRealtime } from './realtime'
import { createVerificationService } from './verification'

/**
 * Block 7 composition: identity/legal from Block 5 plus real places, attendance
 * and place-stats realtime. Matching/chat stay simulated until Block 8.
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
      realtime: mergeRealtime(createRealtimeService(db), simulated.realtime),
    },
    verification,
  )
  return {
    ...simulated,
    ...gated,
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
    moderation: withRealAccountStatus(db, simulated.moderation),
    admin: createAdminService(db, simulated.admin),
  }
}
