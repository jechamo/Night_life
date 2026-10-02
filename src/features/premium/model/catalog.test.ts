import { describe, expect, it } from 'vitest'
import {
  CATALOG,
  normalizePromoCode,
  priceBreakdown,
  PROMO_CODE_RE,
  transitionSubscription,
  withdrawalOpen,
  type Subscription,
} from './catalog'

const sub: Subscription = {
  id: 's1',
  productCode: 'pass_monthly',
  provider: 'stripe',
  status: 'active',
  startedAt: '2026-10-01T10:00:00Z',
  currentPeriodEnd: '2026-11-01T10:00:00Z',
}

describe('catalog (ADR 0008)', () => {
  it('VIP includes everything the Pass has', () => {
    const pass = CATALOG.find((p) => p.code === 'pass_monthly')!
    const vip = CATALOG.find((p) => p.code === 'vip_monthly')!
    expect(pass.entitlements.every((e) => vip.entitlements.includes(e))).toBe(true)
  })

  it('never sells core features (PRD 2.4: verification, safety and filters are free)', () => {
    const all = CATALOG.flatMap((p) => p.entitlements as readonly string[])
    expect(all).not.toContain('advanced_filters')
  })

  it('shows prices with VAT included and its breakdown', () => {
    expect(priceBreakdown({ priceCents: 1210 })).toEqual({
      totalCents: 1210,
      vatCents: 210,
      netCents: 1000,
    })
  })
})

describe('subscription state machine', () => {
  it('cancel keeps benefits until period end, and can be resumed', () => {
    const cancelled = transitionSubscription(sub, 'cancel', new Date('2026-10-05T00:00:00Z'))
    expect(cancelled.status).toBe('cancel_at_period_end')
    expect(cancelled.currentPeriodEnd).toBe(sub.currentPeriodEnd)
    expect(transitionSubscription(cancelled, 'resume', new Date()).status).toBe('active')
  })

  it('withdrawal only within 14 days and ends benefits now', () => {
    const now = new Date('2026-10-10T00:00:00Z')
    expect(withdrawalOpen(sub.startedAt, now)).toBe(true)
    const withdrawn = transitionSubscription(sub, 'withdraw', now)
    expect(withdrawn.status).toBe('withdrawn')
    expect(withdrawn.currentPeriodEnd).toBe(now.toISOString())
    expect(transitionSubscription(sub, 'withdraw', new Date('2026-10-20T00:00:00Z')).status).toBe(
      'active',
    )
  })
})

describe('promo codes', () => {
  it('requires the long format', () => {
    expect(PROMO_CODE_RE.test(normalizePromoCode(' nite-2026-free '))).toBe(true)
    expect(PROMO_CODE_RE.test('FREE')).toBe(false)
  })
})
