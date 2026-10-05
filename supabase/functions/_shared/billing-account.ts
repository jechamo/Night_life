import { json, preflight } from './http.ts'
import { boundedJson } from './request-body.ts'
import { requireUser, serviceClient } from './supabase.ts'
import {
  APP_URL,
  applyEvent,
  currentSubscription,
  rpc,
  stripeClient,
  type PaymentMode,
} from './stripe.ts'

// Account management remains available even when new purchases are disabled.
export async function handleBillingAccount(req: Request, forcedAction?: string): Promise<Response> {
  const early = preflight(req)
  if (early) return early
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)
  const auth = await requireUser(req)
  if (!auth) return json(req, { error: 'unauthorized' }, 401)
  try {
    const input = (await boundedJson(req, 2048)) as {
      action?: string
      orderId?: string
      venueId?: string
    }
    if (forcedAction) input.action = forcedAction
    if (!['portal', 'cancel', 'resume', 'withdraw'].includes(input.action ?? ''))
      return json(req, { error: 'invalid_action' }, 400)
    const service = serviceClient()
    let subQuery = service.from('subscriptions').select('*').eq('user_id', auth.user.id)
    subQuery = input.venueId
      ? subQuery.eq('venue_id', input.venueId)
      : subQuery.is('venue_id', null)
    let { data: sub, error: subError } = await subQuery
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!sub && !subError && input.action === 'portal' && !input.venueId) {
      const fallback = await service
        .from('subscriptions')
        .select('*')
        .eq('user_id', auth.user.id)
        .eq('simulated', false)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      sub = fallback.data
      subError = fallback.error
    }
    if (subError) throw new Error('gateway_error')
    if (sub?.simulated && input.action !== 'portal' && !input.orderId) {
      const state = await rpc(auth.db, 'simulate_billing', {
        p_code: sub.plan_code,
        p_action: input.action,
      })
      return json(req, state)
    }
    if (input.action === 'withdraw') {
      let query = service
        .from('purchase_orders')
        .select('*')
        .eq('user_id', auth.user.id)
        .in('status', ['paid', 'refunded'])
        .order('paid_at', { ascending: false })
        .limit(1)
      if (input.orderId) query = query.eq('id', input.orderId)
      else if (sub) query = query.eq('provider_subscription_id', sub.provider_subscription_id)
      const { data: order, error } = await query.maybeSingle()
      if (error || !order || order.simulated) throw new Error('gateway_error')
      if (order.status === 'refunded') return json(req, await rpc(auth.db, 'premium_state', {}))
      if (!order.paid_at || Date.now() - Date.parse(order.paid_at) > 14 * 86400000)
        return json(req, { error: 'window_closed' }, 409)
      const mode = order.mode as PaymentMode
      const stripe = stripeClient(mode)
      if (order.provider_subscription_id) {
        const current = await stripe.subscriptions.retrieve(order.provider_subscription_id)
        if (current.status !== 'canceled')
          await stripe.subscriptions.cancel(
            current.id,
            { prorate: false, invoice_now: false },
            { idempotencyKey: `nightlife:withdraw-cancel:${order.id}` },
          )
      }
      if (!order.provider_payment_intent_id) throw new Error('gateway_error')
      const refund = await stripe.refunds.create(
        {
          payment_intent: order.provider_payment_intent_id,
          metadata: { app: 'nightlife_connect', order_id: order.id },
        },
        { idempotencyKey: `nightlife:withdraw:${order.id}` },
      )
      // Pending refunds wait for charge.refunded; never fabricate a successful refund.
      if (refund.status !== 'succeeded') return json(req, { error: 'refund_pending' }, 202)
      await applyEvent(service, {
        eventId: `withdraw:${refund.id}`,
        type: 'refund',
        mode,
        paymentIntentId: order.provider_payment_intent_id,
        refundedAmount: refund.amount,
      })
    } else {
      if (!sub || sub.simulated) return json(req, { error: 'no_subscription' }, 409)
      const mode = sub.mode as PaymentMode
      const stripe = stripeClient(mode)
      const customer = await rpc<string>(service, 'billing_customer', {
        p_user: auth.user.id,
        p_mode: mode,
      })
      if (!customer || customer !== sub.provider_customer_id) throw new Error('gateway_error')
      if (input.action === 'portal') {
        const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 100 })
        const config = configs.data.find(
          (c) => c.metadata?.app === 'nightlife_connect' && c.livemode === (mode === 'live'),
        )
        if (!config) throw new Error('not_configured')
        const session = await stripe.billingPortal.sessions.create({
          customer,
          configuration: config.id,
          return_url: input.venueId
            ? `${APP_URL}/venue/${input.venueId}`
            : `${APP_URL}/premium/subscription`,
        })
        return json(req, { url: session.url })
      }
      if (!['active', 'cancel_at_period_end', 'past_due'].includes(sub.status))
        return json(req, { error: 'no_subscription' }, 409)
      await stripe.subscriptions.update(sub.provider_subscription_id, {
        cancel_at_period_end: input.action === 'cancel',
      })
      const current = await currentSubscription(stripe, sub.provider_subscription_id)
      if (current.normalized.customerId !== customer) throw new Error('gateway_error')
      await applyEvent(service, {
        eventId: `account:${crypto.randomUUID()}`,
        type: 'subscription',
        mode,
        ...current.normalized,
      })
    }
    return json(req, await rpc(auth.db, 'premium_state', {}))
  } catch {
    return json(req, { error: 'gateway_error' }, 503)
  }
}
