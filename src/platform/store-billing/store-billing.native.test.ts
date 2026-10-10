import { beforeEach, describe, expect, it, vi } from 'vitest'

const purchases = vi.hoisted(() => ({
  configure: vi.fn(() => Promise.resolve()),
  logIn: vi.fn(() => Promise.resolve()),
  logOut: vi.fn(() => Promise.resolve()),
  getProducts: vi.fn(),
  purchaseStoreProduct: vi.fn(),
  restorePurchases: vi.fn(() => Promise.resolve({})),
  getCustomerInfo: vi.fn(),
}))
const browser = vi.hoisted(() => ({ open: vi.fn(() => Promise.resolve()) }))

vi.mock('@revenuecat/purchases-capacitor', () => ({
  Purchases: purchases,
  PRODUCT_CATEGORY: { SUBSCRIPTION: 'SUBSCRIPTION', NON_SUBSCRIPTION: 'NON_SUBSCRIPTION' },
  PURCHASES_ERROR_CODE: {
    PURCHASE_CANCELLED_ERROR: '1',
    PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR: '5',
    PAYMENT_PENDING_ERROR: '20',
  },
}))
vi.mock('@capacitor/browser', () => ({ Browser: browser }))
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'android' } }))

const { createNativeStoreBilling } = await import('./store-billing.native')

const product = { identifier: 'pass_monthly', title: 'Pase', priceString: '' }

beforeEach(() => vi.clearAllMocks())

describe('native store billing (RevenueCat)', () => {
  it('does nothing before being configured for an account', async () => {
    const store = createNativeStoreBilling()
    expect(store.storeName).toBe('play_store')
    expect(await store.purchase('pass_monthly', 'subscription')).toEqual({
      ok: false,
      error: 'unavailable',
    })
    expect(purchases.purchaseStoreProduct).not.toHaveBeenCalled()
  })

  it('configures once with the account id and switches accounts with logIn', async () => {
    const store = createNativeStoreBilling()
    await store.configure({ apiKey: 'test_key', appUserId: 'user-a' })
    await store.configure({ apiKey: 'test_key', appUserId: 'user-a' })
    await store.configure({ apiKey: 'test_key', appUserId: 'user-b' })
    expect(purchases.configure).toHaveBeenCalledTimes(1)
    expect(purchases.configure).toHaveBeenCalledWith({ apiKey: 'test_key', appUserID: 'user-a' })
    expect(purchases.logIn).toHaveBeenCalledWith({ appUserID: 'user-b' })
  })

  it('buys the store product and maps cancellation and pending payments', async () => {
    const store = createNativeStoreBilling()
    await store.configure({ apiKey: 'k', appUserId: 'u' })
    purchases.getProducts.mockResolvedValue({ products: [product] })
    expect(await store.products(['pass_monthly'], 'subscription')).toEqual({
      ok: true,
      value: [{ identifier: 'pass_monthly', title: 'Pase', priceString: null }],
    })
    expect(purchases.getProducts).toHaveBeenCalledWith({
      productIdentifiers: ['pass_monthly'],
      type: 'SUBSCRIPTION',
    })
    purchases.purchaseStoreProduct.mockResolvedValue({})
    expect((await store.purchase('pass_monthly', 'subscription')).ok).toBe(true)
    expect(purchases.purchaseStoreProduct).toHaveBeenCalledWith({ product })
    purchases.purchaseStoreProduct.mockRejectedValue({ code: '1' })
    expect(await store.purchase('pass_monthly', 'subscription')).toEqual({
      ok: false,
      error: 'cancelled',
    })
    purchases.purchaseStoreProduct.mockRejectedValue({ code: '20' })
    expect(await store.purchase('pass_monthly', 'subscription')).toEqual({
      ok: false,
      error: 'pending',
    })
    purchases.purchaseStoreProduct.mockRejectedValue(new Error('boom'))
    expect(await store.purchase('pass_monthly', 'subscription')).toEqual({
      ok: false,
      error: 'failed',
    })
  })

  it('opens only the stores own management pages', async () => {
    const store = createNativeStoreBilling()
    await store.configure({ apiKey: 'k', appUserId: 'u' })
    purchases.getCustomerInfo.mockResolvedValue({
      customerInfo: { managementURL: 'https://evil.example/manage' },
    })
    expect(await store.manageSubscriptions()).toEqual({ ok: false, error: 'unavailable' })
    purchases.getCustomerInfo.mockResolvedValue({
      customerInfo: { managementURL: 'https://play.google.com/store/account/subscriptions' },
    })
    expect((await store.manageSubscriptions()).ok).toBe(true)
    expect(browser.open).toHaveBeenCalledWith({
      url: 'https://play.google.com/store/account/subscriptions',
    })
  })

  it('forgets the account on sign-out and never throws', async () => {
    const store = createNativeStoreBilling()
    await store.configure({ apiKey: 'k', appUserId: 'u' })
    purchases.logOut.mockRejectedValue(new Error('anonymous'))
    await expect(store.logOut()).resolves.toBeUndefined()
    expect(await store.restore()).toEqual({ ok: false, error: 'unavailable' })
  })
})
