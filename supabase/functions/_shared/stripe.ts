import Stripe from 'npm:stripe@23.0.0'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.2'

export type PaymentMode = 'test' | 'live'
export const APP_URL = 'https://nightlife-connect-beige.vercel.app'

export function stripeClient(mode: PaymentMode): Stripe {
  const key = Deno.env.get(`STRIPE_SECRET_KEY_${mode.toUpperCase()}`) ?? ''
  if (!new RegExp(`^(sk|rk)_${mode}_`).test(key)) throw new Error('not_configured')
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 2 })
}
export function objectId(value: string | { id: string } | null | undefined): string | null {
  return typeof value === 'string' ? value : (value?.id ?? null)
}
export async function rpc<T>(
  db: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await db.rpc(name, args)
  if (error)
    throw new Error(
      error.code === '54000'
        ? 'rate_limited'
        : error.message.includes('already_subscribed')
          ? 'already_subscribed'
          : 'forbidden',
    )
  return data as T
}
export async function invoicePayment(stripe: Stripe, invoice: string): Promise<string | null> {
  const payments = await stripe.invoicePayments.list({ invoice, status: 'paid', limit: 100 })
  for (const item of payments.data) {
    const id = objectId(item.payment.payment_intent)
    if (id) return id
  }
  return null
}
export async function currentSubscription(stripe: Stripe, id: string) {
  const sub = await stripe.subscriptions.retrieve(id)
  const end = Math.min(...sub.items.data.map((i) => i.current_period_end))
  if (!Number.isFinite(end)) throw new Error('invalid_subscription')
  return {
    sub,
    normalized: {
      subscriptionId: sub.id,
      customerId: objectId(sub.customer),
      status: sub.status,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      periodEnd: new Date(end * 1000).toISOString(),
    },
  }
}
export async function applyEvent(db: SupabaseClient, body: Record<string, unknown>): Promise<void> {
  const result = await rpc<{ deferred?: boolean }>(db, 'billing_apply', { p: body })
  if (result.deferred) throw new Error('retry_later')
}
export { Stripe }
