import type { ConsentService } from '@/features/consents/services/consent-service'
import type { LegalService } from '@/features/legal/services/legal-service'
import type { OnboardingService } from '@/features/onboarding/services/onboarding-service'
import type { VerificationService } from '@/features/verification/services/verification-service'
import type { AttendanceService } from '@/features/attendance/services/attendance-service'
import type { ChatService } from '@/features/chats/services/chat-service'
import type { MatchingService } from '@/features/matching/services/matching-service'
import type { PlacesService } from '@/features/places/services/places-service'
import type { ProfileService } from '@/features/profile/services/profile-service'
import type { RealtimeService } from '@/shared/realtime/realtime'
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
  onboarding: OnboardingService
  legal: LegalService
  consents: ConsentService
  verification: VerificationService
  places: PlacesService
  attendance: AttendanceService
  matching: MatchingService
  chat: ChatService
  profile: ProfileService
  realtime: RealtimeService
}
