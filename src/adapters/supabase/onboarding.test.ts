import { describe, expect, it, vi } from 'vitest'
import type { Platform } from '@/platform'
import type { Db } from './client'
import { createOnboardingService } from './onboarding'

const platform = {} as Platform

function auth(overrides: Record<string, unknown>) {
  const db = { auth: overrides } as unknown as Db
  return createOnboardingService(db, platform)
}
const failure = (status: number, code?: string) => ({ error: { status, code, message: 'x' } })

describe('email sign-in adapter (roadmap R1)', () => {
  it('never creates accounts when sending the code', async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null })
    const result = await auth({ signInWithOtp }).requestEmailOtp('ana@example.test')
    expect(result.ok).toBe(true)
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'ana@example.test',
      options: { shouldCreateUser: false },
    })
  })

  it('answers like a sent code when the address has no account (no enumeration)', async () => {
    for (const response of [failure(422, 'otp_disabled'), failure(400, 'user_not_found')]) {
      const signInWithOtp = vi.fn().mockResolvedValue(response)
      expect((await auth({ signInWithOtp }).requestEmailOtp('nobody@example.test')).ok).toBe(true)
    }
  })

  it('maps rate limits and invalid addresses', async () => {
    const limited = vi.fn().mockResolvedValue(failure(429, 'over_email_send_rate_limit'))
    expect(await auth({ signInWithOtp: limited }).requestEmailOtp('a@b.co')).toEqual({
      ok: false,
      error: 'rate_limited',
    })
    const invalid = vi.fn().mockResolvedValue(failure(400, 'email_address_invalid'))
    expect(await auth({ signInWithOtp: invalid }).requestEmailOtp('a@b')).toEqual({
      ok: false,
      error: 'invalid_email',
    })
  })

  it('verifies the code as an email OTP and maps wrong codes', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: null })
    expect((await auth({ verifyOtp }).verifyEmailOtp('a@b.co', '123456')).ok).toBe(true)
    expect(verifyOtp).toHaveBeenCalledWith({ email: 'a@b.co', token: '123456', type: 'email' })
    const wrong = vi.fn().mockResolvedValue(failure(403, 'otp_expired'))
    expect(await auth({ verifyOtp: wrong }).verifyEmailOtp('a@b.co', '000000')).toEqual({
      ok: false,
      error: 'wrong_code',
    })
  })

  it('reads the confirmed email and a pending change', async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          email: 'old@b.co',
          email_confirmed_at: '2026-10-08T00:00:00Z',
          new_email: 'n@b.co',
        },
      },
      error: null,
    })
    expect(await auth({ getUser }).getAccountEmail()).toEqual({
      email: 'old@b.co',
      confirmed: true,
      pendingEmail: 'n@b.co',
    })
  })

  it('maps an address already used by another account', async () => {
    const updateUser = vi.fn().mockResolvedValue(failure(422, 'email_exists'))
    expect(await auth({ updateUser }).changeEmail('taken@b.co')).toEqual({
      ok: false,
      error: 'in_use',
    })
  })
})
