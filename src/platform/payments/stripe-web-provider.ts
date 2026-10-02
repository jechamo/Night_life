import { err, ok } from '@/shared/lib/result'
import type { DeepLinksService } from '../deep-links/deep-links'
import type { InAppBrowserService } from '../in-app-browser/in-app-browser'
import type { CheckoutGateway, PaymentProvider } from './payment-provider'

interface Deps {
  gateway: CheckoutGateway
  browser: InAppBrowserService
  deepLinks: DeepLinksService
}

/** Stripe Checkout / Customer Portal via redirect (no Stripe.js on the page). */
export function createStripeWebProvider({ gateway, browser, deepLinks }: Deps): PaymentProvider {
  const redirect = async (url: string) => {
    const opened = await browser.openExternalFlow(url)
    return opened.ok ? ok(undefined) : err('redirect_failed' as const)
  }
  return {
    id: 'stripe_web',
    async startCheckout(planCode) {
      const session = await gateway.createCheckoutSession({
        planCode,
        successUrl: deepLinks.buildReturnUrl('/premium/return', { status: 'success' }),
        cancelUrl: deepLinks.buildReturnUrl('/premium/return', { status: 'cancelled' }),
      })
      return session.ok ? redirect(session.value.url) : err('gateway_error')
    },
    async openCustomerPortal() {
      const session = await gateway.createPortalSession({
        returnUrl: deepLinks.buildReturnUrl('/premium/subscription'),
      })
      return session.ok ? redirect(session.value.url) : err('gateway_error')
    },
  }
}
