import { describe, expect, it } from 'vitest'
import { hasEntitlement, type Entitlement } from './entitlements'

const now = new Date('2026-10-02T22:00:00Z')
const base: Entitlement = {
  key: 'undo',
  source: 'promo',
  status: 'active',
  startsAt: '2026-10-01T00:00:00Z',
  endsAt: '2026-11-01T00:00:00Z',
}

describe('hasEntitlement', () => {
  it('grants an active entitlement inside its window', () => {
    expect(hasEntitlement([base], 'undo', now)).toBe(true)
  })

  it('denies other keys', () => {
    expect(hasEntitlement([base], 'boost', now)).toBe(false)
  })

  it('denies revoked or expired entitlements', () => {
    expect(hasEntitlement([{ ...base, status: 'revoked' }], 'undo', now)).toBe(false)
    expect(hasEntitlement([{ ...base, status: 'expired' }], 'undo', now)).toBe(false)
  })

  it('respects start and end boundaries', () => {
    expect(hasEntitlement([{ ...base, startsAt: '2026-10-03T00:00:00Z' }], 'undo', now)).toBe(false)
    expect(hasEntitlement([{ ...base, endsAt: now.toISOString() }], 'undo', now)).toBe(false)
  })

  it('open-ended grants never expire', () => {
    expect(hasEntitlement([{ ...base, endsAt: null }], 'undo', now)).toBe(true)
  })
})
