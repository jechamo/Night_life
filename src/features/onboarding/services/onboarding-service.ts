import type { Result } from '@/shared/lib/result'
import type { OnboardingData } from '../model/onboarding-machine'

export type RequestOtpError = 'rate_limited' | 'blocked' | 'invalid_phone' | 'network'
export type VerifyOtpError = 'wrong_code' | 'expired' | 'too_many_attempts' | 'network'

/**
 * Port for account creation (Supabase Auth phone + OTP from Block 5). Limits
 * (SMS rate, attempts, banned phone/device HMACs) are enforced server-side; the
 * client only maps the typed errors to generic, translated messages.
 */
export interface OnboardingService {
  /** Public hint for the local mock only; real Auth codes are never exposed. */
  readonly testOtpCode?: string
  getStatus(): Promise<'pending' | 'completed'>
  requestOtp(phone: string): Promise<Result<{ resendAfterSeconds: number }, RequestOtpError>>
  verifyOtp(phone: string, code: string): Promise<Result<void, VerifyOtpError>>
  complete(data: OnboardingData): Promise<Result<void, 'network'>>
  /** Testing tool: forget the onboarding (mock only / test tools). */
  reset(): Promise<void>
}
