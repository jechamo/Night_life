// RevenueCat webhook (Bloque 11b). Authenticated by the Authorization header configured in
// the RevenueCat dashboard (secret REVENUECAT_WEBHOOK_AUTH). The body only names customers:
// their state is always re-read from the API and applied idempotently. 200 means applied;
// any other status makes RevenueCat retry (5, 10, 20, 40, 80 minutes).
import { boundedJson } from '../_shared/request-body.ts'
import { revenueCatClient, sameSecret, webhookCustomers } from '../_shared/revenuecat.ts'
import { serviceClient } from '../_shared/supabase.ts'

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405)
  if (!sameSecret(req.headers.get('authorization'), Deno.env.get('REVENUECAT_WEBHOOK_AUTH') ?? ''))
    return reply({ error: 'unauthorized' }, 401)
  let event: { id?: unknown } & Record<string, unknown>
  try {
    const body = (await boundedJson(req, 64 * 1024)) as { event?: unknown }
    if (!body.event || typeof body.event !== 'object') return reply({ error: 'bad_request' }, 400)
    event = body.event as typeof event
  } catch {
    return reply({ error: 'bad_request' }, 400)
  }
  const customers = webhookCustomers(event)
  // Anonymous ids ($RCAnonymousID) never map to an account: nothing to apply.
  if (!customers.length) return reply({ ignored: true })
  const eventId =
    typeof event.id === 'string' && event.id.length <= 120 ? event.id : crypto.randomUUID()
  try {
    const client = revenueCatClient()
    const db = serviceClient()
    let applied = 0
    for (const customer of customers) {
      const snapshot = await client.customerSnapshot(
        customer,
        `rcwh:${eventId}:${customer}`,
        'webhook',
      )
      const { error } = await db.rpc('store_apply', { p_user: customer, p: snapshot })
      // 22023 = no such account (e.g. deleted): acknowledged, nothing to retry.
      if (error && error.code !== '22023') throw new Error('apply_failed')
      if (!error) applied++
    }
    return reply({ applied })
  } catch {
    console.error('revenuecat webhook failed')
    return reply({ error: 'retry_later' }, 503)
  }
})
