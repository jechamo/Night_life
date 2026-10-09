import { json, preflight } from '../_shared/http.ts'
import { boundedJson } from '../_shared/request-body.ts'
import { requireUser, serviceClient } from '../_shared/supabase.ts'
import { APP_URL, rpc, stripeClient, type PaymentMode } from '../_shared/stripe.ts'

interface Order {
  createdAt: string
  id: string
  userId: string
  code: string
  kind: string
  mode: PaymentMode
  priceId: string
  amount: number
  sessionId: string | null
  interval: 'month' | 'year' | null
  intervalCount: number
}
Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)
  const auth = await requireUser(req)
  if (!auth) return json(req, { error: 'unauthorized' }, 401)
  try {
    const input = (await boundedJson(req, 2048)) as {
      code?: unknown
      venueId?: unknown
      from?: unknown
      immediateStart?: unknown
    }
    if (typeof input.code !== 'string') return json(req, { error: 'invalid_plan' }, 400)
    // Consumers must ask to start now and accept losing withdrawal for what they use
    // (TRLGDCU arts. 103 and 108). Venue purchases are business-to-business.
    if (input.venueId === undefined && input.immediateStart !== true)
      return json(req, { error: 'consent_required' }, 400)
    if (
      input.venueId !== undefined &&
      (typeof input.venueId !== 'string' || !/^[\da-f-]{36}$/i.test(input.venueId))
    )
      return json(req, { error: 'invalid_venue' }, 400)
    if (
      input.from !== undefined &&
      (typeof input.from !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.from))
    )
      return json(req, { error: 'invalid_dates' }, 400)
    const order = input.venueId
      ? await rpc<Order>(auth.db, 'billing_start_venue_order', {
          p_code: input.code,
          p_venue: input.venueId,
          p_from: input.from ?? null,
        })
      : await rpc<Order>(auth.db, 'billing_start_order', { p_code: input.code })
    const stripe = stripeClient(order.mode)
    const service = serviceClient()
    if (!input.venueId)
      await rpc(service, 'billing_record_consent', { p_order: order.id, p_user: auth.user.id })
    let customer = await rpc<string | null>(service, 'billing_customer', {
      p_user: auth.user.id,
      p_mode: order.mode,
    })
    if (!customer) {
      // Idempotency prevents duplicate customers if the database attachment retries.
      const created = await stripe.customers.create(
        { metadata: { app: 'nightlife_connect', user_id: auth.user.id } },
        { idempotencyKey: `nightlife:customer:${order.mode}:${auth.user.id}` },
      )
      customer = await rpc<string>(service, 'billing_customer', {
        p_user: auth.user.id,
        p_mode: order.mode,
        p_customer: created.id,
      })
    }
    const price = await stripe.prices.retrieve(order.priceId)
    if (
      price.livemode !== (order.mode === 'live') ||
      !price.active ||
      price.unit_amount !== order.amount ||
      price.currency !== 'eur' ||
      (order.kind === 'subscription'
        ? price.recurring?.interval !== order.interval ||
          price.recurring?.interval_count !== order.intervalCount
        : price.recurring !== null)
    )
      throw new Error('price_mismatch')
    const old = order.sessionId ? await stripe.checkout.sessions.retrieve(order.sessionId) : null
    if (old?.status === 'open' && old.url)
      return json(req, { url: old.url, orderId: order.id, mode: order.mode })
    if (old) return json(req, { error: 'already_subscribed' }, 409)
    // The UUID is random; deriving the suffix keeps retries byte-for-byte identical.
    const suffix = order.id
      .replaceAll('-', '')
      .slice(0, 16)
      .match(/../g)!
      .map((b) => String.fromCharCode(97 + (Number.parseInt(b, 16) % 26)))
      .join('')
    const session = await stripe.checkout.sessions.create(
      {
        mode: order.kind === 'subscription' ? 'subscription' : 'payment',
        customer,
        client_reference_id: order.id,
        expires_at: Math.floor(Date.parse(order.createdAt) / 1000) + 86400,
        line_items: [{ price: order.priceId, quantity: 1 }],
        success_url: `${APP_URL}/premium/return?status=success&order=${order.id}${input.venueId ? `&venue=${input.venueId}` : ''}`,
        cancel_url: `${APP_URL}/premium/return?status=cancelled${input.venueId ? `&venue=${input.venueId}` : ''}`,
        metadata: { app: 'nightlife_connect', order_id: order.id },
        integration_identifier: `nightlife_web_${suffix}`,
        ...(order.kind === 'subscription'
          ? {
              subscription_data: {
                billing_mode: { type: 'flexible' },
                metadata: { app: 'nightlife_connect', order_id: order.id },
              },
            }
          : { invoice_creation: { enabled: true } }),
      },
      { idempotencyKey: `nightlife:checkout:${order.id}` },
    )
    if (!session.url) throw new Error('gateway_error')
    await rpc(service, 'billing_attach_session', { p_order: order.id, p_session: session.id })
    return json(req, { url: session.url, orderId: order.id, mode: order.mode })
  } catch (error) {
    const code =
      error instanceof Error &&
      ['rate_limited', 'already_subscribed', 'not_configured', 'forbidden'].includes(error.message)
        ? error.message
        : 'gateway_error'
    return json(
      req,
      { error: code },
      code === 'forbidden' ? 403 : code === 'rate_limited' ? 429 : 503,
    )
  }
})
