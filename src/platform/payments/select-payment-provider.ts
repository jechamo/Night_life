import type { PlatformRuntime } from '../types'
import { disabledPaymentProvider } from './disabled-provider'
import type { PaymentProvider } from './payment-provider'

export interface PaymentProviderFactoryInput {
  runtime: PlatformRuntime
  /** Result of the flag/role policy (`resolvePaywallState(...) === 'checkout'`). */
  purchasesAllowed: boolean
  /** Lazily built so no gateway is created when purchases are off. */
  createStripeWeb: () => PaymentProvider
}

/**
 * Factory (PRD 3.4): picks the payment strategy from flags + environment.
 * Fails closed: anything unexpected yields the disabled provider.
 */
export function selectPaymentProvider(input: PaymentProviderFactoryInput): PaymentProvider {
  if (!input.purchasesAllowed) return disabledPaymentProvider
  switch (input.runtime) {
    case 'web':
      return input.createStripeWeb()
    case 'native':
      // Store billing (Apple/Google) arrives with Annex B. Until then, no purchases in the shell.
      return disabledPaymentProvider
  }
}
