// RevenueCat REST API v2 (Bloque 11b). The secret key stays in Edge Functions; the app only
// receives the public SDK key. Purchases are always re-read from the API: a webhook body is
// a notification, never proof of payment (same rule as stripe-webhook).
const BASE = 'https://api.revenuecat.com/v2'
const DEFAULT_PROJECT = 'proj1484f178'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_PAGES = 10

export const isCustomerId = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value)

export interface StoreSubscription {
  id: string
  store: string
  environment: string
  productIdentifier: string
  givesAccess: boolean
  autoRenewal: string
  status: string
  startsAt: string | null
  periodStart: string | null
  periodEnd: string | null
}

export interface StorePurchase {
  id: string
  store: string
  environment: string
  productIdentifier: string
  status: string
  purchasedAt: string | null
  quantity: number
}

export interface StoreSnapshot {
  eventId: string
  source: 'sync' | 'webhook'
  subscriptions: StoreSubscription[]
  purchases: StorePurchase[]
}

type Json = Record<string, unknown>
const record = (value: unknown): value is Json =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown, max = 255) =>
  typeof value === 'string' && value.length > 0 && value.length <= max ? value : null
const iso = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? new Date(value).toISOString()
    : null

/** RevenueCat returns its own product ids; the server maps them to store identifiers. */
export function productIndex(items: unknown[]): Map<string, string> {
  const index = new Map<string, string>()
  for (const item of items) {
    if (!record(item)) continue
    const id = text(item.id)
    const storeId = text(item.store_identifier, 200)
    if (id && storeId) index.set(id, storeId)
  }
  return index
}

/** Keeps only the fields store_apply needs; unknown products and malformed rows are dropped. */
export function normalizeSnapshot(input: {
  eventId: string
  source: 'sync' | 'webhook'
  subscriptions: unknown[]
  purchases: unknown[]
  products: Map<string, string>
}): StoreSnapshot {
  const subscriptions: StoreSubscription[] = []
  for (const item of input.subscriptions) {
    if (!record(item)) continue
    const id = text(item.id)
    const productIdentifier = text(item.product_id)
      ? input.products.get(item.product_id as string)
      : null
    const store = text(item.store, 40)
    if (!id || !productIdentifier || !store) continue
    subscriptions.push({
      id,
      store,
      environment: text(item.environment, 40) ?? 'production',
      productIdentifier,
      givesAccess: item.gives_access === true,
      autoRenewal: text(item.auto_renewal_status, 60) ?? 'unknown',
      status: text(item.status, 60) ?? 'unknown',
      startsAt: iso(item.starts_at),
      periodStart: iso(item.current_period_starts_at),
      // `ends_at` covers an already-renewed next period; otherwise it equals the current end.
      periodEnd: iso(item.ends_at) ?? iso(item.current_period_ends_at),
    })
  }
  const purchases: StorePurchase[] = []
  for (const item of input.purchases) {
    if (!record(item)) continue
    const id = text(item.id)
    const productIdentifier = text(item.product_id)
      ? input.products.get(item.product_id as string)
      : null
    const store = text(item.store, 40)
    if (!id || !productIdentifier || !store) continue
    purchases.push({
      id,
      store,
      environment: text(item.environment, 40) ?? 'production',
      productIdentifier,
      status: text(item.status, 40) ?? 'unknown',
      purchasedAt: iso(item.purchased_at),
      quantity: typeof item.quantity === 'number' ? item.quantity : 1,
    })
  }
  return { eventId: input.eventId, source: input.source, subscriptions, purchases }
}

export class RevenueCatError extends Error {
  readonly status: number
  constructor(status: number) {
    super(`revenuecat_${status}`)
    this.status = status
  }
}

/** Deno.env without a hard dependency on the Deno global (the module is unit-tested in Node). */
const env = (name: string): string | undefined =>
  (globalThis as { Deno?: { env: { get(key: string): string | undefined } } }).Deno?.env.get(name)

export function revenueCatClient(
  secret = env('REVENUECAT_SECRET') ?? '',
  project = env('REVENUECAT_PROJECT_ID') ?? DEFAULT_PROJECT,
  fetcher: typeof fetch = fetch,
) {
  if (!secret) throw new RevenueCatError(503)
  const projectPath = `/projects/${encodeURIComponent(project)}`
  const request = async (path: string): Promise<Json | null> => {
    const response = await fetcher(
      path.startsWith('/v2/') ? `https://api.revenuecat.com${path}` : `${BASE}${path}`,
      {
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
      },
    )
    if (response.status === 404) return null
    if (!response.ok) throw new RevenueCatError(response.status)
    const body: unknown = await response.json()
    return record(body) ? body : null
  }
  // Follows `next_page` (relative /v2 paths only) with a hard page limit.
  const list = async (path: string): Promise<unknown[]> => {
    const items: unknown[] = []
    let next: string | null = path
    for (let page = 0; next && page < MAX_PAGES; page++) {
      const body = await request(next)
      if (!body) break
      if (Array.isArray(body.items)) items.push(...body.items)
      next =
        typeof body.next_page === 'string' && body.next_page.startsWith(`/v2${projectPath}/`)
          ? body.next_page
          : null
    }
    return items
  }
  return {
    request,
    list,
    apps: () => list(`${projectPath}/apps?limit=100`),
    products: () => list(`${projectPath}/products?limit=100&expand=items.app`),
    publicKeys: (appId: string) =>
      list(`${projectPath}/apps/${encodeURIComponent(appId)}/public_api_keys`),
    /** 404 for a random id proves read access to customers; 401/403 means it is missing. */
    async probeCustomers(): Promise<'ok' | 'denied' | 'error'> {
      try {
        await request(`${projectPath}/customers/${crypto.randomUUID()}`)
        return 'ok'
      } catch (cause) {
        return cause instanceof RevenueCatError && (cause.status === 401 || cause.status === 403)
          ? 'denied'
          : 'error'
      }
    },
    /** Never creates a customer; an unknown id simply has no purchases. */
    async customerSnapshot(customerId: string, eventId: string, source: 'sync' | 'webhook') {
      if (!isCustomerId(customerId)) throw new RevenueCatError(400)
      const customer = `${projectPath}/customers/${encodeURIComponent(customerId)}`
      const [subscriptions, purchases, products] = await Promise.all([
        list(`${customer}/subscriptions?limit=100`),
        list(`${customer}/purchases?limit=100`),
        list(`${projectPath}/products?limit=100`),
      ])
      return normalizeSnapshot({
        eventId,
        source,
        subscriptions,
        purchases,
        products: productIndex(products),
      })
    },
  }
}

/** Store product type and Test Store duration expected for a plan (store-admin check). */
export function expectedProduct(plan: { interval: string | null; intervalCount: number }): {
  type: string
  duration: string | null
} {
  if (!plan.interval) return { type: 'consumable', duration: null }
  if (plan.interval === 'year') return { type: 'subscription', duration: 'P1Y' }
  return { type: 'subscription', duration: `P${plan.intervalCount}M` }
}

/** Constant-time comparison for the webhook Authorization header. */
export function sameSecret(header: string | null, secret: string): boolean {
  if (!header || !secret) return false
  const value = header.startsWith('Bearer ') ? header.slice(7) : header
  if (value.length !== secret.length) return false
  let mismatch = 0
  for (let i = 0; i < value.length; i++) mismatch |= value.charCodeAt(i) ^ secret.charCodeAt(i)
  return mismatch === 0
}

/** Customer ids named by a webhook (including transfers), limited and validated. */
export function webhookCustomers(event: unknown): string[] {
  if (!record(event)) return []
  const ids = new Set<string>()
  const add = (value: unknown) => {
    if (isCustomerId(value)) ids.add(value.toLowerCase())
  }
  add(event.app_user_id)
  add(event.original_app_user_id)
  for (const key of ['aliases', 'transferred_from', 'transferred_to']) {
    const list = event[key]
    if (Array.isArray(list)) list.forEach(add)
  }
  return [...ids].slice(0, 5)
}
