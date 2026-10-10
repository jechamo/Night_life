import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePlatform, type StoreError, type StoreProductKind } from '@/platform'
import { entitlementsQueryKey } from '@/shared/entitlements/use-entitlement'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'
import { err, ok, type Result } from '@/shared/lib/result'
import { useServices } from '@/shared/services/ServicesProvider'
import { beginSessionWork, useSessionMutation } from '@/shared/session/use-session-mutation'
import { productByCode, type ProductCode } from '../model/catalog'
import type {
  PurchaseError,
  StoreServiceError,
  VenueProductCode,
} from '../services/premium-service'
import { premiumKey, useStartVenuePurchase } from './use-premium'

export const storeConfigKey = ['premium', 'store-config'] as const

/** Outcome of a store action as the screens show it. */
export type StoreOutcome = 'done' | 'pending' | 'cancelled'
export type StoreFailure = StoreError | StoreServiceError | PurchaseError

const VENUE_SUBSCRIPTIONS: readonly string[] = ['venue_pro_monthly']
const kindOf = (code: string): StoreProductKind =>
  productByCode(code)?.kind === 'subscription' || VENUE_SUBSCRIPTIONS.includes(code)
    ? 'subscription'
    : 'other'

/**
 * Block 11b: the native app buys in the device's store (Test Store while testing). Only in
 * the native shell, with `store_payments_enabled` on; the web keeps Stripe. Every outcome
 * is re-read by the server (store sync) before benefits change: the client grants nothing.
 */
export function useStoreBilling() {
  const { store } = usePlatform()
  const { premium, session } = useServices()
  const queryClient = useQueryClient()
  const flag = useFeatureFlag('store_payments_enabled')
  const enabled = store.available && flag === 'on' && !!premium.storeConfig

  const config = useQuery({
    queryKey: storeConfigKey,
    enabled,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const check = beginSessionWork(session)
      const result = await premium.storeConfig!()
      check()
      if (!result.ok) throw new Error(result.error)
      const configured = await store.configure({
        apiKey: result.value.apiKey,
        appUserId: result.value.userId,
      })
      check()
      if (!configured.ok) throw new Error(configured.error)
      return result.value
    },
  })

  const refresh = async () => {
    const check = beginSessionWork(session)
    const synced = await premium.syncStore!()
    check()
    if (synced.ok) queryClient.setQueryData(premiumKey, synced.value)
    await queryClient.invalidateQueries({ queryKey: entitlementsQueryKey })
    await queryClient.invalidateQueries({ queryKey: ['matching', 'likes-used'] })
    await queryClient.invalidateQueries({ queryKey: ['venue-panel'] })
    return synced
  }

  /** Pays in the store, then lets the server apply what the store confirms. */
  const pay = async (
    identifier: string,
    code: string,
  ): Promise<Result<StoreOutcome, StoreFailure>> => {
    const paid = await store.purchase(identifier, kindOf(code))
    if (!paid.ok && paid.error === 'cancelled') return ok('cancelled')
    if (!paid.ok && paid.error !== 'pending') return err(paid.error)
    const synced = await refresh()
    if (!synced.ok) return err(synced.error)
    return ok(paid.ok ? 'done' : 'pending')
  }

  const buy = useSessionMutation({
    mutationFn: async (code: ProductCode): Promise<Result<StoreOutcome, StoreFailure>> => {
      const identifier = config.data?.products[code]
      if (!identifier) return err('unavailable')
      return pay(identifier, code)
    },
  })

  const buyForVenue = useSessionMutation({
    mutationFn: async ({
      code,
      venueId,
      from,
    }: {
      code: VenueProductCode
      venueId: string
      from?: string
    }): Promise<Result<StoreOutcome, StoreFailure>> => {
      if (!config.data || !premium.startStoreVenueOrder) return err('unavailable')
      // The slot (city quota, dates) is reserved first, exactly as with Stripe.
      const reserved = await premium.startStoreVenueOrder(code, venueId, from)
      if (!reserved.ok) return err(reserved.error)
      return pay(reserved.value.productIdentifier, code)
    },
  })

  const restore = useSessionMutation({
    mutationFn: async (): Promise<Result<StoreOutcome, StoreFailure>> => {
      const restored = await store.restore()
      if (!restored.ok) return err(restored.error)
      const synced = await refresh()
      return synced.ok ? ok('done') : err(synced.error)
    },
  })

  const manage = useSessionMutation({ mutationFn: () => store.manageSubscriptions() })

  return {
    /** Store purchases are offered here (native shell, flag on, service available). */
    enabled,
    ready: config.isSuccess,
    failed: config.isError,
    storeName: store.storeName,
    /** TEST purchases go to RevenueCat's Test Store, whatever the device's store is. */
    testing: config.data?.mode === 'test',
    productId: (code: string) => config.data?.products[code as ProductCode],
    buy,
    buyForVenue,
    restore,
    manage,
  }
}

/** Localised title and price from the store, when it has them (Test Store may not). */
export function useStoreProduct(identifier: string | undefined, code: string) {
  const { store } = usePlatform()
  return useQuery({
    queryKey: ['premium', 'store-product', identifier],
    enabled: !!identifier && store.available,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const result = await store.products([identifier!], kindOf(code))
      return result.ok ? (result.value[0] ?? null) : null
    },
  })
}

/**
 * Venue purchases (sponsorship tiers, Pro): the device's store inside the native app, Stripe
 * Checkout on the web. Same server rules either way (slot reservation, manager checks).
 */
export function useVenueCheckout() {
  const store = useStoreBilling()
  const stripe = useStartVenuePurchase()
  if (store.enabled) {
    const data = store.buyForVenue.data
    return {
      viaStore: true,
      pay: (input: { code: VenueProductCode; venueId: string; from?: string }) =>
        store.buyForVenue.mutate(input),
      pending: !store.ready || store.buyForVenue.isPending,
      failed: store.failed || store.buyForVenue.isError || (!!data && !data.ok),
      outcome: data?.ok ? data.value : null,
      manage: () => store.manage.mutate(),
    }
  }
  return {
    viaStore: false,
    pay: (input: { code: VenueProductCode; venueId: string; from?: string }) =>
      stripe.mutate(input),
    pending: stripe.isPending,
    failed: stripe.isError || (!!stripe.data && !stripe.data.ok),
    outcome: null,
    manage: null,
  }
}
