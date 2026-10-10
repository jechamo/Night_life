import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import {
  PRODUCT_CATEGORY,
  PURCHASES_ERROR_CODE,
  Purchases,
  type PurchasesStoreProduct,
} from '@revenuecat/purchases-capacitor'
import { err, ok } from '@/shared/lib/result'
import type { StoreBillingService, StoreError, StoreProductKind } from './store-billing'

const category = (kind: StoreProductKind) =>
  kind === 'subscription' ? PRODUCT_CATEGORY.SUBSCRIPTION : PRODUCT_CATEGORY.NON_SUBSCRIPTION

function toError(error: unknown): StoreError {
  const code = (error as { code?: unknown } | null)?.code
  if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return 'cancelled'
  if (code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) return 'pending'
  if (code === PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR) return 'unavailable'
  return 'failed'
}

/**
 * RevenueCat (App Store / Google Play; Test Store while testing). The public SDK key comes
 * from the server (never bundled), and the app user id is the Supabase account id, so a
 * purchase can only ever be applied to the signed-in account.
 */
export function createNativeStoreBilling(): StoreBillingService {
  let configuredKey: string | null = null
  let currentUser: string | null = null
  // Store products by identifier, needed to purchase (the SDK wants the full object).
  const cache = new Map<string, PurchasesStoreProduct>()

  const guard = async <T>(run: () => Promise<T>): Promise<T | StoreError> => {
    if (!configuredKey || !currentUser) return 'unavailable'
    try {
      return await run()
    } catch (error) {
      return toError(error)
    }
  }

  return {
    available: true,
    storeName: Capacitor.getPlatform() === 'ios' ? 'app_store' : 'play_store',
    async configure({ apiKey, appUserId }) {
      try {
        if (configuredKey !== apiKey) {
          await Purchases.configure({ apiKey, appUserID: appUserId })
          configuredKey = apiKey
        } else if (currentUser !== appUserId) {
          await Purchases.logIn({ appUserID: appUserId })
        }
        currentUser = appUserId
        return ok(undefined)
      } catch {
        return err('unavailable')
      }
    },
    async products(identifiers, kind) {
      const result = await guard(() =>
        Purchases.getProducts({ productIdentifiers: identifiers, type: category(kind) }),
      )
      if (typeof result === 'string') return err(result)
      result.products.forEach((product) => cache.set(product.identifier, product))
      return ok(
        result.products.map((product) => ({
          identifier: product.identifier,
          title: product.title,
          // Test Store products without a price must not crash the screen.
          priceString: product.priceString || null,
        })),
      )
    },
    async purchase(identifier, kind) {
      const result = await guard(async () => {
        let product = cache.get(identifier)
        if (!product) {
          const found = await Purchases.getProducts({
            productIdentifiers: [identifier],
            type: category(kind),
          })
          product = found.products[0]
        }
        if (!product) return 'unavailable' as const
        await Purchases.purchaseStoreProduct({ product })
        return 'done' as const
      })
      return result === 'done' ? ok(undefined) : err(result)
    },
    async restore() {
      const result = await guard(() => Purchases.restorePurchases())
      return typeof result === 'string' ? err(result) : ok(undefined)
    },
    async manageSubscriptions() {
      const result = await guard(() => Purchases.getCustomerInfo())
      if (typeof result === 'string') return err(result)
      const url = result.customerInfo.managementURL
      // Only the stores' own HTTPS pages (Test Store has none).
      if (!url || !/^https:\/\/(apps\.apple\.com|play\.google\.com)\//.test(url))
        return err('unavailable')
      try {
        await Browser.open({ url })
        return ok(undefined)
      } catch {
        return err('failed')
      }
    },
    async logOut() {
      if (!configuredKey || !currentUser) return
      currentUser = null
      cache.clear()
      // Fails when the SDK already has an anonymous user: nothing else to forget.
      await Purchases.logOut().catch(() => undefined)
    },
  }
}
