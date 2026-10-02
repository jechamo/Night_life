import { describe, expect, it, vi } from 'vitest'
import { err, ok } from '@/shared/lib/result'
import { createFakePlatform } from '../testing'
import { disabledPaymentProvider } from './disabled-provider'
import type { CheckoutGateway } from './payment-provider'
import { selectPaymentProvider } from './select-payment-provider'
import { createStripeWebProvider } from './stripe-web-provider'

const gateway = (url = 'https://checkout.stripe.com/c/pay/cs_test'): CheckoutGateway => ({
  createCheckoutSession: vi.fn(() => Promise.resolve(ok({ url }))),
  createPortalSession: vi.fn(() => Promise.resolve(ok({ url: 'https://billing.stripe.com/p/x' }))),
})

describe('selectPaymentProvider', () => {
  const createStripeWeb = () => ({ ...disabledPaymentProvider, id: 'stripe_web' as const })

  it('returns the disabled provider when purchases are not allowed', () => {
    const provider = selectPaymentProvider({
      runtime: 'web',
      purchasesAllowed: false,
      createStripeWeb,
    })
    expect(provider.id).toBe('disabled')
  })

  it('uses Stripe on the web when allowed', () => {
    const provider = selectPaymentProvider({
      runtime: 'web',
      purchasesAllowed: true,
      createStripeWeb,
    })
    expect(provider.id).toBe('stripe_web')
  })

  it('keeps the native shell closed until store billing exists (Annex B)', () => {
    const provider = selectPaymentProvider({
      runtime: 'native',
      purchasesAllowed: true,
      createStripeWeb,
    })
    expect(provider.id).toBe('disabled')
  })
})

describe('Stripe web provider', () => {
  it('creates a session with platform return URLs and redirects through the allowlist', async () => {
    const platform = createFakePlatform()
    const open = vi.spyOn(platform.browser, 'openExternalFlow')
    const gw = gateway()
    const provider = createStripeWebProvider({
      gateway: gw,
      browser: platform.browser,
      deepLinks: platform.deepLinks,
    })

    await expect(provider.startCheckout('premium_monthly')).resolves.toEqual(ok(undefined))
    expect(gw.createCheckoutSession).toHaveBeenCalledWith({
      planCode: 'premium_monthly',
      successUrl: 'https://app.test/premium/return?status=success',
      cancelUrl: 'https://app.test/premium/return?status=cancelled',
    })
    expect(open).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test')
  })

  it('surfaces gateway failures as a typed error', async () => {
    const platform = createFakePlatform()
    const gw: CheckoutGateway = {
      createCheckoutSession: () => Promise.resolve(err('gateway_error')),
      createPortalSession: () => Promise.resolve(err('gateway_error')),
    }
    const provider = createStripeWebProvider({
      gateway: gw,
      browser: platform.browser,
      deepLinks: platform.deepLinks,
    })
    await expect(provider.openCustomerPortal()).resolves.toEqual(err('gateway_error'))
  })
})
