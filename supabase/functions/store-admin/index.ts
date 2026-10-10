// Store catalogue check for admins with MFA (Bloque 11b). Read-only: compares the RevenueCat
// Test Store products with `plans` and checks the key's permissions. Products are created in
// the RevenueCat dashboard because the API cannot set Test Store prices (docs/STORE_CATALOG.md).
import { json, preflight } from '../_shared/http.ts'
import { RevenueCatError, expectedProduct, revenueCatClient } from '../_shared/revenuecat.ts'
import { requireUser } from '../_shared/supabase.ts'

interface Plan {
  code: string
  kind: string
  priceCents: number
  interval: string | null
  intervalCount: number
  test: string | null
}
type Json = Record<string, unknown>
const record = (value: unknown): value is Json =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)
  const auth = await requireUser(req)
  if (!auth) return json(req, { error: 'unauthorized' }, 401)
  const { data, error } = await auth.db.rpc('store_admin_catalog')
  if (error) return json(req, { error: 'forbidden' }, 403)
  const plans = data as Plan[]
  try {
    const client = revenueCatClient()
    const apps = (await client.apps()).filter(record)
    const testApp = apps.find((app) => app.type === 'test_store') ?? null
    const sdkKey = Deno.env.get('REVENUECAT_SDK_TEST') ?? ''
    let sdkKeyMatches = false
    if (testApp && typeof testApp.id === 'string') {
      const keys = await client.publicKeys(testApp.id).catch(() => [])
      sdkKeyMatches = Boolean(sdkKey) && keys.some((key) => record(key) && key.key === sdkKey)
    }
    const customers = await client.probeCustomers()
    // The app may come as `app_id` or as the expanded `app` object.
    const appOf = (item: Json) =>
      typeof item.app_id === 'string' ? item.app_id : record(item.app) ? item.app.id : undefined
    const products = (await client.products())
      .filter(record)
      .filter((item) => !testApp || appOf(item) === undefined || appOf(item) === testApp.id)
    const byStoreId = new Map(products.map((item) => [String(item.store_identifier), item]))
    const rows = plans.map((plan) => {
      const expected = expectedProduct(plan)
      const found = plan.test ? byStoreId.get(plan.test) : undefined
      const duration = record(found?.subscription)
        ? ((found.subscription.duration as string | undefined) ?? null)
        : null
      const typeOk =
        found && (found.type === expected.type || (!expected.duration && found.type === 'one_time'))
      const status = !found
        ? 'missing'
        : typeOk && (!expected.duration || duration === expected.duration)
          ? 'ok'
          : 'mismatch'
      return {
        code: plan.code,
        storeId: plan.test,
        priceCents: plan.priceCents,
        expected,
        found: found ? { type: found.type, duration } : null,
        status,
      }
    })
    const known = new Set(plans.map((plan) => plan.test))
    return json(req, {
      testStoreApp: testApp ? { id: testApp.id, name: testApp.name } : null,
      sdkKeyConfigured: Boolean(sdkKey),
      sdkKeyMatches,
      customers,
      products: rows,
      extra: products.map((item) => String(item.store_identifier)).filter((id) => !known.has(id)),
    })
  } catch (cause) {
    const status = cause instanceof RevenueCatError ? cause.status : 0
    console.error('store-admin failed', status)
    return json(
      req,
      { error: status === 401 || status === 403 ? 'key_denied' : 'unavailable' },
      503,
    )
  }
})
