import { describe, expect, it, vi } from 'vitest'
import { isOnboarded, type Db } from './client'
import { createSessionService } from './core-services'

function client({ session = true, completed = true, error = false, sessionError = false } = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: completed ? { onboarded_at: '2026-10-03T12:00:00Z' } : null,
    error: error ? { message: 'private database detail' } : null,
  })
  const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }))
  const db = {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: session ? { user: { id: 'current-user' } } : null },
        error: sessionError ? { message: 'private auth detail' } : null,
      }),
    },
    from,
  } as unknown as Db
  return { db, from }
}

describe('persisted onboarding status', () => {
  it('does not read a profile when signed out', async () => {
    const { db, from } = client({ session: false })
    await expect(isOnboarded(db)).resolves.toBe(false)
    expect(from).not.toHaveBeenCalled()
  })
  it('recognizes a completed profile and an absent profile', async () => {
    await expect(isOnboarded(client().db)).resolves.toBe(true)
    await expect(isOnboarded(client({ completed: false }).db)).resolves.toBe(false)
  })
  it('does not classify a database failure as an incomplete account', async () => {
    await expect(isOnboarded(client({ error: true }).db)).rejects.toThrow('profile_unavailable')
  })
  it('does not classify an Auth failure as a signed-out account', async () => {
    await expect(isOnboarded(client({ sessionError: true }).db)).rejects.toThrow(
      'session_unavailable',
    )
  })
  it('propagates sign-out failures instead of reporting a closed session', async () => {
    const db = {
      auth: { signOut: vi.fn().mockResolvedValue({ error: { message: 'offline' } }) },
    } as unknown as Db
    await expect(createSessionService(db).signOut()).rejects.toThrow('sign_out_failed')
    expect(db.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})
