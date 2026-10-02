import type { ConsentService } from '@/features/consents/services/consent-service'
import type { LegalService } from '@/features/legal/services/legal-service'
import type { OnboardingService } from '@/features/onboarding/services/onboarding-service'
import type { VerificationStatus } from '@/features/verification/model/verification'
import { DEFAULT_AGE_THRESHOLD } from '@/features/verification/model/verification'
import type { VerificationService } from '@/features/verification/services/verification-service'
import { err, ok } from '@/shared/lib/result'
import { getMockLegalDocument } from './legal-documents.mock'
import type { MockStore } from './mock-store'

/** Fixed test code, like Supabase test phone numbers (PRD 6.14). */
export const MOCK_OTP_CODE = '123456'
/** Simulates a phone whose HMAC is in `ban_identifiers`. */
export const MOCK_BANNED_PHONE = '+34600000000'
const MAX_SENDS_PER_WINDOW = 3
const MAX_WRONG_ATTEMPTS = 5
const RESEND_AFTER_SECONDS = 30

type Wait = () => Promise<void>

export function createMockOnboardingService(store: MockStore, wait: Wait): OnboardingService {
  let sends = 0
  let wrongAttempts = 0
  return {
    getStatus: async () => ((await store.read()).onboarded ? 'completed' : 'pending'),
    async requestOtp(phone) {
      await wait()
      if (phone === MOCK_BANNED_PHONE) return err('blocked')
      if (++sends > MAX_SENDS_PER_WINDOW) return err('rate_limited')
      return ok({ resendAfterSeconds: RESEND_AFTER_SECONDS })
    },
    async verifyOtp(_phone, code) {
      await wait()
      if (wrongAttempts >= MAX_WRONG_ATTEMPTS) return err('too_many_attempts')
      if (code !== MOCK_OTP_CODE) {
        wrongAttempts += 1
        return err(wrongAttempts >= MAX_WRONG_ATTEMPTS ? 'too_many_attempts' : 'wrong_code')
      }
      wrongAttempts = 0
      return ok(undefined)
    },
    async complete() {
      await wait()
      await store.update((s) => ({ ...s, onboarded: true }))
      return ok(undefined)
    },
    async reset() {
      sends = 0
      wrongAttempts = 0
      await store.update((s) => ({ ...s, onboarded: false, signed: [] }))
    },
  }
}

export function createMockLegalService(store: MockStore, wait: Wait): LegalService {
  return {
    async getDocuments(slugs, language) {
      await wait()
      return slugs.flatMap((slug) => getMockLegalDocument(slug, language) ?? [])
    },
    async sign(documents) {
      await wait()
      const signedAt = new Date().toISOString()
      const signed = documents.map(({ slug, version }) => ({ slug, version, signedAt }))
      await store.update((s) => ({
        ...s,
        signed: [...s.signed.filter((d) => !signed.some((n) => n.slug === d.slug)), ...signed],
      }))
      return signed
    },
    getSigned: async () => (await store.read()).signed,
  }
}

export function createMockConsentService(store: MockStore, wait: Wait): ConsentService {
  const toState = (s: Awaited<ReturnType<MockStore['read']>>) => ({
    choices: s.consents,
    city: s.city,
    updatedAt: s.consentsUpdatedAt,
  })
  return {
    getMine: async () => toState(await store.read()),
    async save(choices, city) {
      await wait()
      const now = new Date().toISOString()
      const next = await store.update((s) => {
        const updatedAt = { ...s.consentsUpdatedAt }
        for (const key of Object.keys(choices) as (keyof typeof choices)[]) {
          if (choices[key] !== s.consents[key]) updatedAt[key] = now
        }
        return { ...s, consents: { ...choices }, city, consentsUpdatedAt: updatedAt }
      })
      return toState(next)
    },
  }
}

export function createMockVerificationService(store: MockStore, wait: Wait): VerificationService {
  const set = (level: 'age' | 'photo' | 'identity', status: VerificationStatus) =>
    store.update((s) => ({ ...s, verification: { ...s.verification, [level]: status } }))

  return {
    getSnapshot: async () => (await store.read()).verification,
    async start(level) {
      await wait()
      await set(level, { state: 'pending', providerSessionId: `sandbox_${level}_${Date.now()}` })
      // A real adapter returns Yoti's URL (allowlisted); the sandbox is an internal screen.
      return ok({ type: 'internal', path: `/verification/sandbox?level=${level}` })
    },
    async requestHumanReview(level) {
      await wait()
      return (await set(level, { state: 'manual_review', reason: 'requested' })).verification
    },
    async simulateResult(level, outcome) {
      await wait()
      const verifiedAt = new Date().toISOString()
      const status: VerificationStatus =
        outcome === 'approved'
          ? level === 'age'
            ? {
                state: 'verified',
                method: 'facial_estimation',
                thresholdUsed: DEFAULT_AGE_THRESHOLD,
                verifiedAt,
              }
            : { state: 'verified', verifiedAt }
          : outcome === 'borderline'
            ? { state: 'manual_review', reason: 'borderline' }
            : outcome === 'inconclusive'
              ? { state: 'pending', providerSessionId: `sandbox_${level}_document` }
              : { state: 'failed', canRequestReview: true }
      return (await set(level, status)).verification
    },
  }
}
