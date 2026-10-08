import type { Result } from '@/shared/lib/result'
import type { OnboardingData } from '../model/onboarding-machine'

export type RequestOtpError = 'rate_limited' | 'blocked' | 'invalid_phone' | 'network'
export type VerifyOtpError = 'wrong_code' | 'expired' | 'too_many_attempts' | 'network'
export type RequestEmailOtpError = 'rate_limited' | 'invalid_email' | 'network'
export type ChangeEmailError = 'invalid_email' | 'in_use' | 'rate_limited' | 'network'

/** Email of the signed-in account: confirmed address and an unconfirmed change, if any. */
export interface AccountEmail {
  email: string | null
  confirmed: boolean
  pendingEmail: string | null
}

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
  /**
   * Roadmap R1: returning users sign in with a code sent to their CONFIRMED email.
   * Never creates accounts (sign-up still needs phone, signature and ban checks), and
   * answers the same whether or not the address has an account (no enumeration).
   */
  requestEmailOtp(
    email: string,
  ): Promise<Result<{ resendAfterSeconds: number }, RequestEmailOtpError>>
  verifyEmailOtp(email: string, code: string): Promise<Result<void, VerifyOtpError>>
  getAccountEmail(): Promise<AccountEmail>
  /** Adds or changes the email; the provider sends a confirmation link to it. */
  changeEmail(email: string): Promise<Result<void, ChangeEmailError>>
  /** Testing tool: forget the onboarding (mock only / test tools). */
  reset(): Promise<void>
}
