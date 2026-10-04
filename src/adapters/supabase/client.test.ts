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

describe('persisted session roles', () => {
  function fixture({ signedIn = true, activityError = false, rolesError = false } = {}) {
    const eq = vi.fn().mockResolvedValue({
      data: [{ role: 'user' }, { role: 'tester' }, { role: 'admin' }],
      error: rolesError ? { message: 'private role detail' } : null,
    })
    const from = vi.fn(() => ({ select: () => ({ eq }) }))
    const rpc = vi.fn().mockResolvedValue({
      // PostgREST returns null for the successful void account_activity RPC.
      data: null,
      error: activityError ? { message: 'private activity detail' } : null,
    })
    const db = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: signedIn ? { user: { id: 'current-user' } } : null },
        }),
      },
      from,
      rpc,
    } as unknown as Db
    return { service: createSessionService(db), from, rpc, eq }
  }

  it('reads the signed-in roles after a successful void activity response', async () => {
    const { service, rpc, from, eq } = fixture()
    await expect(service.getRoles()).resolves.toEqual(['user', 'tester', 'admin'])
    expect(rpc).toHaveBeenCalledWith('account_activity')
    expect(from).toHaveBeenCalledWith('user_roles')
    expect(eq).toHaveBeenCalledWith('user_id', 'current-user')
  })

  it('does not read roles or record activity without a session', async () => {
    const { service, rpc, from } = fixture({ signedIn: false })
    await expect(service.getRoles()).resolves.toEqual([])
    expect(rpc).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })

  it('still rejects an actual activity error before reading roles', async () => {
    const { service, from } = fixture({ activityError: true })
    await expect(service.getRoles()).rejects.toThrow()
    expect(from).not.toHaveBeenCalled()
  })

  it('does not invent roles when their database lookup fails', async () => {
    await expect(fixture({ rolesError: true }).service.getRoles()).rejects.toThrow('db_error')
  })
})
