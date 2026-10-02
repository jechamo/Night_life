import { err } from '@/shared/lib/result'
import type { PaymentProvider } from './payment-provider'

/** Used whenever purchases are not allowed: the UI shows "coming soon" or nothing. */
export const disabledPaymentProvider: PaymentProvider = {
  id: 'disabled',
  startCheckout: () => Promise.resolve(err('payments_disabled')),
  openCustomerPortal: () => Promise.resolve(err('payments_disabled')),
}
