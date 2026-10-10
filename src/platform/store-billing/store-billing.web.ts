import { err } from '@/shared/lib/result'
import type { StoreBillingService } from './store-billing'

/** The browser has no app store: web purchases go through Stripe (premium service). */
export function createWebStoreBilling(): StoreBillingService {
  const unavailable = () => Promise.resolve(err('unavailable' as const))
  return {
    available: false,
    storeName: null,
    configure: unavailable,
    products: unavailable,
    purchase: unavailable,
    restore: unavailable,
    manageSubscriptions: unavailable,
    logOut: () => Promise.resolve(),
  }
}
