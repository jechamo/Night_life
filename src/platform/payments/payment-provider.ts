import type { Result } from '@/shared/lib/result'

export type PaymentProviderId = 'stripe_web' | 'app_store' | 'play_store' | 'disabled'

export type PaymentError =
  'payments_disabled' | 'gateway_error' | 'redirect_failed' | 'not_implemented'

/**
 * Strategy for "how this platform charges money" (PRD 6.13 point 2).
 * The app never asks "has the user paid?": it asks for entitlements. A provider
 * only starts flows; the server (webhooks) grants entitlements.
 */
export interface PaymentProvider {
  readonly id: PaymentProviderId
  startCheckout(planCode: string): Promise<Result<void, PaymentError>>
  openCustomerPortal(): Promise<Result<void, PaymentError>>
}

/**
 * Backend port implemented in Block 9 by the `create-checkout-session` and
 * `create-portal-session` Edge Functions. The server picks test/live keys from
 * `payments_mode`; the client never sees a secret key.
 */
export interface CheckoutGateway {
  createCheckoutSession(input: {
    planCode: string
    successUrl: string
    cancelUrl: string
  }): Promise<Result<{ url: string }, 'gateway_error'>>
  createPortalSession(input: {
    returnUrl: string
  }): Promise<Result<{ url: string }, 'gateway_error'>>
}
