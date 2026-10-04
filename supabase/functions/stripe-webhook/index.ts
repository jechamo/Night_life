import { json } from '../_shared/http.ts'
import { boundedText } from '../_shared/request-body.ts'
import { serviceClient } from '../_shared/supabase.ts'
import {
  rpc,
  applyEvent,
  currentSubscription,
  invoicePayment,
  objectId,
  Stripe,
  stripeClient,
  type PaymentMode,
} from '../_shared/stripe.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)
  let raw: string
  try {
    raw = await boundedText(req, 262144)
  } catch {
    return json(req, { error: 'invalid_body' }, 400)
  }
  const signature = req.headers.get('stripe-signature')
  if (!signature) return json(req, { error: 'invalid_signature' }, 400)
  let event: Stripe.Event | null = null
  let mode: PaymentMode = 'test'
  for (const candidate of ['test', 'live'] as const) {
    const secret = Deno.env.get(`STRIPE_WEBHOOK_SECRET_${candidate.toUpperCase()}`)
    if (!secret) continue
    try {
      event = await Stripe.webhooks.constructEventAsync(
        raw,
        signature,
        secret,
        300,
        Stripe.createSubtleCryptoProvider(),
      )
      mode = candidate
      break
    } catch {
      /* try the other independently configured environment */
    }
  }
  if (!event || event.livemode !== (mode === 'live'))
    return json(req, { error: 'invalid_signature' }, 400)
  try {
    const stripe = stripeClient(mode)
    const db = serviceClient()
    const base = { eventId: event.id, mode, simulated: false }
    const object = event.data.object
    const id = 'id' in object && typeof object.id === 'string' ? object.id : null
    if (!id) return json(req, { ignored: true })
    if (
      ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(
        event.type,
      )
    ) {
      const session = await stripe.checkout.sessions.retrieve(id)
      if (session.metadata?.app !== 'nightlife_connect') return json(req, { ignored: true })
      if (session.payment_status !== 'paid' || session.status !== 'complete')
        return json(req, { ignored: true })
      const { data: order } = await db
        .from('purchase_orders')
        .select('*')
        .eq('id', session.client_reference_id)
        .maybeSingle()
      const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 })
      if (
        !order ||
        order.provider_session_id !== session.id ||
        items.data.length !== 1 ||
        items.data[0].price?.id !== order.price_id ||
        items.data[0].quantity !== 1
      )
        throw new Error('order_mismatch')
      if (!order.user_id) return json(req, { ignored: true })
      const customer = await db.rpc('billing_customer', { p_user: order.user_id, p_mode: mode })
      if (customer.error || customer.data !== objectId(session.customer))
        throw new Error('customer_mismatch')
      const subId = objectId(session.subscription)
      const sub = subId ? await currentSubscription(stripe, subId) : null
      const invId = objectId(session.invoice)
      const invoice = invId ? await stripe.invoices.retrieve(invId) : null
      const pi =
        objectId(session.payment_intent) ?? (invId ? await invoicePayment(stripe, invId) : null)
      await applyEvent(db, {
        ...base,
        type: 'checkout',
        orderId: order.id,
        sessionId: session.id,
        amount: session.amount_total,
        currency: session.currency,
        customerId: objectId(session.customer),
        paymentIntentId: pi,
        invoiceId: invId,
        invoiceUrl: invoice?.hosted_invoice_url,
        ...(sub?.normalized ?? {}),
      })
      if (sub)
        await applyEvent(db, {
          ...base,
          eventId: `${event.id}:subscription`,
          type: 'subscription',
          ...sub.normalized,
        })
    } else if (event.type.startsWith('customer.subscription.')) {
      const sub = await currentSubscription(stripe, id)
      if (sub.sub.metadata.app !== 'nightlife_connect') return json(req, { ignored: true })
      const { data: owner, error: ownerError } = await db
        .from('subscriptions')
        .select('user_id')
        .eq('provider_subscription_id', id)
        .maybeSingle()
      if (ownerError) throw new Error('db_unavailable')
      if (owner && !owner.user_id) return json(req, { ignored: true })
      const providerCustomer = objectId(sub.sub.customer)
      if (!owner && providerCustomer && (await stripe.customers.retrieve(providerCustomer)).deleted)
        return json(req, { ignored: true })
      const oldItems = (
        event.data.previous_attributes as
          { items?: { data?: { price?: { id?: string } }[] } } | undefined
      )?.items?.data
      if (oldItems && oldItems[0]?.price?.id !== sub.sub.items.data[0]?.price.id)
        await rpc(db, 'billing_price_notice', { p_subscription: id, p_mode: mode, p_ref: event.id })
      await applyEvent(db, {
        ...base,
        type:
          event.type === 'customer.subscription.trial_will_end' ? 'trial_ending' : 'subscription',
        ...sub.normalized,
      })
    } else if (['invoice.paid', 'invoice.payment_failed'].includes(event.type)) {
      const invoice = await stripe.invoices.retrieve(id)
      const subId = objectId(invoice.parent?.subscription_details?.subscription)
      if (!subId) return json(req, { ignored: true })
      const sub = await currentSubscription(stripe, subId)
      if (sub.sub.metadata.app !== 'nightlife_connect') return json(req, { ignored: true })
      await applyEvent(db, {
        ...base,
        type: event.type === 'invoice.paid' ? 'invoice_paid' : 'payment_failed',
        ...sub.normalized,
        invoiceId: invoice.id,
        amount: invoice.amount_paid,
        invoiceUrl: invoice.hosted_invoice_url,
        paymentIntentId: await invoicePayment(stripe, invoice.id),
      })
    } else if (event.type === 'charge.refunded') {
      const charge = await stripe.charges.retrieve(id)
      if (charge.refunded && charge.payment_intent) {
        const { data: order, error } = await db
          .from('purchase_orders')
          .select('provider_subscription_id')
          .eq('provider_payment_intent_id', objectId(charge.payment_intent))
          .eq('mode', mode)
          .maybeSingle()
        if (error) throw new Error('db_unavailable')
        if (order?.provider_subscription_id) {
          const sub = await stripe.subscriptions.retrieve(order.provider_subscription_id)
          if (sub.status !== 'canceled')
            await stripe.subscriptions.cancel(
              sub.id,
              { prorate: false, invoice_now: false },
              { idempotencyKey: `nightlife:refund-cancel:${charge.id}` },
            )
        }
      }
      await applyEvent(db, {
        ...base,
        type: 'refund',
        paymentIntentId: objectId(charge.payment_intent),
        refundedAmount: charge.amount_refunded,
      })
    } else return json(req, { ignored: true })
    return json(req, { received: true })
  } catch {
    console.error('stripe_webhook_processing_failed')
    return json(req, { error: 'retry_later' }, 503)
  }
})
