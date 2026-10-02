import type { Platform } from '@/platform'
import { createFlagService } from '@/shared/flags/flag-service'
import type { AppServices } from '@/shared/services/services'
import { createAdminService } from './admin'
import { createSupabaseClient } from './client'
import { createEntitlementService, createFlagSource, createSessionService } from './core-services'
import { createLegalService } from './legal'
import { createOnboardingService } from './onboarding'
import { createPrivacyService, withRealAccountStatus } from './privacy'
import { createConsentService, createProfileService, createSafetyService } from './profile'

/**
 * Block 5 composition (ADR 0009): Supabase for identity, legal evidence, consents,
 * profile, flags, entitlements, roles, SOS contacts, privacy and the admin core.
 * Everything else keeps the simulated services until its block.
 */
export function createSupabaseServices(
  config: { url: string; publishableKey: string },
  platform: Platform,
  simulated: AppServices,
): AppServices {
  const db = createSupabaseClient(config, platform.secureStorage)
  return {
    ...simulated,
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
