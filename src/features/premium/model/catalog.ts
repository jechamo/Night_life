import type { EntitlementKey } from '@/shared/entitlements/entitlements'

/**
 * Product catalogue (docs/MONETIZATION.md, ADR 0008). One catalogue for every channel:
 * Stripe on the web, App Store / Google Play in the native apps. The ids per store live
 * server-side (`plans` table, Block 9); the client only knows codes and benefits.
 * Prices are placeholders to validate with the accountant; they always include VAT.
 */
export type ProductKind = 'subscription' | 'one_night' | 'credits'
export type CreditKind = 'spark' | 'spotlight' | 'paid_dm'
export type ProductCode =
  | 'pass_monthly'
  | 'vip_monthly'
  | 'one_night'
  | 'sparks_5'
  | 'spotlight_1'
  | 'paid_dm_1'
  | 'sparks_1'
  | 'sparks_15'
  | 'pass_quarterly'
  | 'pass_annual'
  | 'sponsor_featured'
  | 'sponsor_featured_plus'
  | 'sponsor_top'
  | 'venue_pro_monthly'

export interface Product {
  code: ProductCode
  kind: ProductKind
  /** Price in cents, VAT included (PRD 6.13 "precio con IVA"). */
  priceCents: number
  currency: 'EUR'
  interval: 'month' | 'quarter' | 'year' | null
  entitlements: readonly EntitlementKey[]
  credits?: { kind: CreditKind; amount: number; perWeek?: boolean }[]
  highlighted?: boolean
}

const PASS: EntitlementKey[] = [
  'unlimited_likes',
  'undo',
  'travel_mode',
  'premium_themes',
  'no_sponsored_cards',
]
const VIP: EntitlementKey[] = [...PASS, 'see_likes', 'priority_likes', 'incognito', 'boost']
export const VENUE_PRICES = { featured: 2900, featured_plus: 4900, top: 7900, pro: 1999 } as const

export const CATALOG: readonly Product[] = [
  {
    code: 'pass_quarterly',
    kind: 'subscription',
    priceCents: 2699,
    currency: 'EUR',
    interval: 'quarter',
    entitlements: PASS,
  },
  {
    code: 'pass_annual',
    kind: 'subscription',
    priceCents: 8999,
    currency: 'EUR',
    interval: 'year',
    entitlements: PASS,
  },
  {
    code: 'sparks_1',
    kind: 'credits',
    priceCents: 149,
    currency: 'EUR',
    interval: null,
    entitlements: [],
    credits: [{ kind: 'spark', amount: 1 }],
  },
  {
    code: 'sparks_15',
    kind: 'credits',
    priceCents: 1199,
    currency: 'EUR',
    interval: null,
    entitlements: [],
    credits: [{ kind: 'spark', amount: 15 }],
  },
  {
    code: 'pass_monthly',
    kind: 'subscription',
    priceCents: 999,
    currency: 'EUR',
    interval: 'month',
    entitlements: PASS,
  },
  {
    code: 'vip_monthly',
    kind: 'subscription',
    priceCents: 1999,
    currency: 'EUR',
    interval: 'month',
    entitlements: VIP,
    credits: [
      { kind: 'spotlight', amount: 1, perWeek: true },
      { kind: 'spark', amount: 3, perWeek: true },
      { kind: 'paid_dm', amount: 2, perWeek: true },
    ],
    highlighted: true,
  },
  {
    code: 'one_night',
    kind: 'one_night',
    priceCents: 299,
    currency: 'EUR',
    interval: null,
    entitlements: PASS,
    credits: [{ kind: 'spotlight', amount: 1 }],
  },
  {
    code: 'sparks_5',
    kind: 'credits',
    priceCents: 499,
    currency: 'EUR',
    interval: null,
    entitlements: [],
    credits: [{ kind: 'spark', amount: 5 }],
  },
  {
    code: 'spotlight_1',
    kind: 'credits',
    priceCents: 399,
    currency: 'EUR',
    interval: null,
    entitlements: [],
    credits: [{ kind: 'spotlight', amount: 1 }],
  },
  {
    code: 'paid_dm_1',
    kind: 'credits',
    priceCents: 199,
    currency: 'EUR',
    interval: null,
    entitlements: [],
    credits: [{ kind: 'paid_dm', amount: 1 }],
  },
]

export const productByCode = (code: string): Product | undefined =>
  CATALOG.find((p) => p.code === code)

/** Spanish VAT (to be confirmed with the accountant / Stripe Tax before going live). */
export const VAT_RATE = 0.21

export function priceBreakdown(product: Pick<Product, 'priceCents'>): {
  totalCents: number
  vatCents: number
  netCents: number
} {
  const netCents = Math.round(product.priceCents / (1 + VAT_RATE))
  return { totalCents: product.priceCents, vatCents: product.priceCents - netCents, netCents }
}

export const formatPrice = (cents: number, locale: string): string =>
  (cents / 100).toLocaleString(locale, { style: 'currency', currency: 'EUR' })

/** Statutory withdrawal period for distance contracts (14 days). */
export const WITHDRAWAL_DAYS = 14

export function withdrawalOpen(startedAt: string, now: Date): boolean {
  return now.getTime() - Date.parse(startedAt) < WITHDRAWAL_DAYS * 86_400_000
}

export type SubscriptionStatus =
  'active' | 'cancel_at_period_end' | 'withdrawn' | 'expired' | 'past_due'

export interface Subscription {
  simulated?: boolean
  id: string
  productCode: ProductCode
  /** `test_store` = RevenueCat Test Store (Block 11b); stores manage their own billing. */
  provider: 'stripe' | 'apple' | 'google' | 'test_store'
  status: SubscriptionStatus
  startedAt: string
  currentPeriodEnd: string
}

/**
 * Subscription transitions (state machine, PRD 3.4). Cancelling keeps benefits until the
 * end of the period; withdrawing (within 14 days) ends them now and refunds.
 */
export function transitionSubscription(
  sub: Subscription,
  action: 'cancel' | 'resume' | 'withdraw',
  now: Date,
): Subscription {
  if (sub.status === 'withdrawn' || sub.status === 'expired') return sub
  switch (action) {
    case 'cancel':
      return sub.status === 'active' ? { ...sub, status: 'cancel_at_period_end' } : sub
    case 'resume':
      return sub.status === 'cancel_at_period_end' ? { ...sub, status: 'active' } : sub
    case 'withdraw':
      return withdrawalOpen(sub.startedAt, now)
        ? { ...sub, status: 'withdrawn', currentPeriodEnd: now.toISOString() }
        : sub
  }
}

/** Promo codes: long and alphanumeric to resist brute force (PRD 6.15 E). */
export const PROMO_CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/
export const normalizePromoCode = (raw: string): string =>
  raw.trim().toUpperCase().replace(/\s+/g, '')
