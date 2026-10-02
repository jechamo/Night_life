import { describe, expect, it } from 'vitest'
import type { Role } from '@/shared/session/roles'
import { INITIAL_FLAG_VALUES, type FeatureFlags } from './flags'
import { canPurchase, resolvePaywallState } from './paywall'

const flags = (overrides: Partial<FeatureFlags>): FeatureFlags => ({
  ...INITIAL_FLAG_VALUES,
  ...overrides,
})
const USER: Role[] = ['user']
const TESTER: Role[] = ['user', 'tester']

describe('paywall policy (PRD 6.13)', () => {
  it('initial setup: testers get the real checkout, everyone else "coming soon"', () => {
    expect(resolvePaywallState(INITIAL_FLAG_VALUES, TESTER)).toBe('checkout')
    expect(resolvePaywallState(INITIAL_FLAG_VALUES, USER)).toBe('coming_soon')
  })

  it('audience = none: nobody sees payment', () => {
    const f = flags({ payments_audience: 'none', paywall_visibility: 'visible' })
    expect(canPurchase(f, TESTER)).toBe(false)
    expect(resolvePaywallState(f, TESTER)).toBe('coming_soon')
    expect(resolvePaywallState(f, USER)).toBe('coming_soon')
  })

  it('audience = all: everybody can buy', () => {
    const f = flags({ payments_audience: 'all', paywall_visibility: 'visible' })
    expect(resolvePaywallState(f, USER)).toBe('checkout')
  })

  it('payments_mode = disabled is an immediate rollback', () => {
    const f = flags({ payments_mode: 'disabled', payments_audience: 'all' })
    expect(canPurchase(f, TESTER)).toBe(false)
  })

  it('premium off hides everything', () => {
    const f = flags({ premium_enabled: 'off', payments_audience: 'all' })
    expect(resolvePaywallState(f, TESTER)).toBe('hidden')
  })

  it('hidden paywall stays hidden for non-buyers', () => {
    const f = flags({ paywall_visibility: 'hidden' })
    expect(resolvePaywallState(f, USER)).toBe('hidden')
  })
})
