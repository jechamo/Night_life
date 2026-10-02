import type { Result } from '@/shared/lib/result'
import type { AgeMethod, VerificationLevel, VerificationSnapshot } from '../model/verification'

/**
 * Where to send the user to verify. Real providers are external (Yoti) and come
 * back via a return URL; the sandbox mock is an internal route.
 */
export type VerificationRedirect =
  { type: 'external'; url: string } | { type: 'internal'; path: string }

export type SandboxOutcome = 'approved' | 'inconclusive' | 'denied' | 'borderline'

/**
 * Port for verifications (PRD 6.2). Results arrive server-side through a signed
 * webhook (Block 6); the client only reads booleans and states.
 */
export interface VerificationService {
  getSnapshot(): Promise<VerificationSnapshot>
  start(
    level: VerificationLevel,
    method?: AgeMethod,
  ): Promise<Result<VerificationRedirect, 'unavailable'>>
  requestHumanReview(level: VerificationLevel): Promise<VerificationSnapshot>
  /** Sandbox only (verification_mode = sandbox + test tools): simulates the provider webhook. */
  simulateResult(level: VerificationLevel, outcome: SandboxOutcome): Promise<VerificationSnapshot>
}
