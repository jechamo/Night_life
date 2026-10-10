// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
  expectedProduct,
  normalizeSnapshot,
  productIndex,
  revenueCatClient,
  sameSecret,
  webhookCustomers,
} from '../supabase/functions/_shared/revenuecat.ts'

const USER = '0b5f8c2e-1d3a-4b6c-9e7f-a1b2c3d4e5f6'
const products = productIndex([
  { id: 'prod_pass', store_identifier: 'pass_monthly' },
  { id: 'prod_sparks', store_identifier: 'sparks_5' },
  { id: 'bad' },
])

describe('RevenueCat normalisation (Block 11b)', () => {
  it('maps RevenueCat product ids to store identifiers and keeps only needed fields', () => {
    const snapshot = normalizeSnapshot({
      eventId: 'sync:1',
      source: 'sync',
      products,
      subscriptions: [
        {
          id: 'sub_1',
          product_id: 'prod_pass',
          store: 'test_store',
          environment: 'sandbox',
          gives_access: true,
          auto_renewal_status: 'will_renew',
          status: 'active',
          starts_at: 1_790_000_000_000,
          current_period_starts_at: 1_790_000_000_000,
          current_period_ends_at: 1_790_000_300_000,
          ends_at: null,
          management_url: 'https://example.com/secret',
        },
        { id: 'sub_unknown', product_id: 'prod_missing', store: 'test_store' },
      ],
      purchases: [
        {
          id: 'pur_1',
          product_id: 'prod_sparks',
          store: 'test_store',
          environment: 'sandbox',
          status: 'owned',
          purchased_at: 1_790_000_000_000,
          quantity: 1,
          revenue_in_usd: { gross: 5 },
        },
        'not an object',
      ],
    })
    expect(snapshot.subscriptions).toEqual([
      {
        id: 'sub_1',
        store: 'test_store',
        environment: 'sandbox',
        productIdentifier: 'pass_monthly',
        givesAccess: true,
        autoRenewal: 'will_renew',
        status: 'active',
        startsAt: new Date(1_790_000_000_000).toISOString(),
        periodStart: new Date(1_790_000_000_000).toISOString(),
        periodEnd: new Date(1_790_000_300_000).toISOString(),
      },
    ])
    expect(snapshot.purchases).toHaveLength(1)
    expect(snapshot.purchases[0]).not.toHaveProperty('revenue_in_usd')
    expect(snapshot.purchases[0]?.productIdentifier).toBe('sparks_5')
  })

  it('prefers ends_at when the next period is already paid', () => {
    const snapshot = normalizeSnapshot({
      eventId: 'e',
      source: 'webhook',
      products,
      subscriptions: [
        {
          id: 's',
          product_id: 'prod_pass',
          store: 'app_store',
          current_period_ends_at: 1000,
          ends_at: 2000,
          gives_access: 'yes',
        },
      ],
      purchases: [],
    })
    expect(snapshot.subscriptions[0]?.periodEnd).toBe(new Date(2000).toISOString())
    // Only a real boolean grants access.
    expect(snapshot.subscriptions[0]?.givesAccess).toBe(false)
  })
})

describe('webhook helpers', () => {
  it('compares the Authorization header in constant time, with or without Bearer', () => {
    expect(sameSecret('rcwh_abc', 'rcwh_abc')).toBe(true)
    expect(sameSecret('Bearer rcwh_abc', 'rcwh_abc')).toBe(true)
    expect(sameSecret('rcwh_abd', 'rcwh_abc')).toBe(false)
    expect(sameSecret(null, 'rcwh_abc')).toBe(false)
    expect(sameSecret('rcwh_abc', '')).toBe(false)
  })

  it('only names account ids (no anonymous ids), including transfers, at most five', () => {
    expect(
      webhookCustomers({
        app_user_id: '$RCAnonymousID:abc',
        original_app_user_id: USER,
        transferred_to: [USER.toUpperCase(), 'nope'],
      }),
    ).toEqual([USER])
    expect(webhookCustomers('x')).toEqual([])
    const many = Array.from({ length: 8 }, (_, i) => `0b5f8c2e-1d3a-4b6c-9e7f-a1b2c3d4e5f${i}`)
    expect(webhookCustomers({ aliases: many })).toHaveLength(5)
  })

  it('derives the Test Store type and duration for each plan', () => {
    expect(expectedProduct({ interval: 'month', intervalCount: 1 })).toEqual({
      type: 'subscription',
      duration: 'P1M',
    })
    expect(expectedProduct({ interval: 'month', intervalCount: 3 })).toEqual({
      type: 'subscription',
      duration: 'P3M',
    })
    expect(expectedProduct({ interval: 'year', intervalCount: 1 })).toEqual({
      type: 'subscription',
      duration: 'P1Y',
    })
    expect(expectedProduct({ interval: null, intervalCount: 1 })).toEqual({
      type: 'consumable',
      duration: null,
    })
  })
})

describe('RevenueCat client', () => {
  const reply = (body: unknown, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }))

  it('sends the secret as Bearer, follows only same-project pages and never creates customers', async () => {
    const fetcher = vi.fn((url: string) => {
      if (url.includes('/products'))
        return reply({
          items: [{ id: 'prod_pass', store_identifier: 'pass_monthly' }],
          next_page: null,
        })
      if (url.includes('/subscriptions') && !url.includes('starting_after'))
        return reply({
          items: [{ id: 's1', product_id: 'prod_pass', store: 'test_store', gives_access: true }],
          next_page: '/v2/projects/proj_x/customers/c/subscriptions?starting_after=s1',
        })
      if (url.includes('starting_after'))
        return reply({ items: [], next_page: 'https://evil.example/v2/projects/proj_x/x' })
      return reply({ type: 'resource_missing' }, 404)
    })
    const client = revenueCatClient('sk_test', 'proj_x', fetcher as unknown as typeof fetch)
    const snapshot = await client.customerSnapshot(USER, 'sync:1', 'sync')
    expect(snapshot.subscriptions).toHaveLength(1)
    expect(snapshot.purchases).toEqual([])
    const calls = fetcher.mock.calls.map(([url]) => url)
    expect(
      calls.every((url) => url.startsWith('https://api.revenuecat.com/v2/projects/proj_x/')),
    ).toBe(true)
    const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk_test')
    expect(init.redirect).toBe('error')
  })

  it('rejects malformed customer ids and surfaces API errors for retries', async () => {
    const fetcher = vi.fn(() => reply({}, 500))
    const client = revenueCatClient('sk_test', 'proj_x', fetcher)
    await expect(client.customerSnapshot('../admin', 'e', 'sync')).rejects.toThrow('revenuecat_400')
    await expect(client.customerSnapshot(USER, 'e', 'sync')).rejects.toThrow('revenuecat_500')
    expect(() => revenueCatClient('', 'proj_x', fetcher as unknown as typeof fetch)).toThrow(
      'revenuecat_503',
    )
  })

  it('reports a missing customers permission without throwing', async () => {
    const denied = revenueCatClient('sk', 'p', () => reply({}, 403))
    expect(await denied.probeCustomers()).toBe('denied')
    const allowed = revenueCatClient('sk', 'p', () => reply({}, 404))
    expect(await allowed.probeCustomers()).toBe('ok')
  })
})
