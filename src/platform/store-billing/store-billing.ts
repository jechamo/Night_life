import type { Result } from '@/shared/lib/result'

/** A product as the store sells it (localised title and price come from the store). */
export interface StoreProduct {
  identifier: string
  title: string
  priceString: string | null
}

export type StoreError = 'unavailable' | 'cancelled' | 'pending' | 'failed'
export type StoreProductKind = 'subscription' | 'other'

/**
 * Port for App Store / Google Play purchases (Block 11b, RevenueCat). The web has no store:
 * it keeps Stripe through the premium service. A successful purchase here grants nothing by
 * itself: the server re-reads the purchase from RevenueCat and applies the entitlements.
 */
export interface StoreBillingService {
  readonly available: boolean
  /** The device's store (App Store on iOS, Google Play on Android); null on the web. */
  readonly storeName: 'app_store' | 'play_store' | null
  /** Configures the store SDK for this account (idempotent; switches account on change). */
  configure(input: { apiKey: string; appUserId: string }): Promise<Result<void, StoreError>>
  products(
    identifiers: string[],
    kind: StoreProductKind,
  ): Promise<Result<StoreProduct[], StoreError>>
  purchase(identifier: string, kind: StoreProductKind): Promise<Result<void, StoreError>>
  restore(): Promise<Result<void, StoreError>>
  /** Opens the store's own subscription management, when the store provides it. */
  manageSubscriptions(): Promise<Result<void, StoreError>>
  /** Forgets the account on this device (sign-out). Never throws. */
  logOut(): Promise<void>
}
