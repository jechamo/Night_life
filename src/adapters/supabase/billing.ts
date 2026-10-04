import { z } from 'zod'
import type { PremiumService } from '@/features/premium/services/premium-service'
import { err, ok } from '@/shared/lib/result'
import type { Db } from './client'
import { must } from './errors'

export const productCodeSchema = z.enum([
  'pass_monthly',
  'vip_monthly',
  'one_night',
  'sparks_5',
  'spotlight_1',
  'paid_dm_1',
])
export const premiumStateSchema = z.object({
  subscription: z
    .object({
      id: z.string(),
      productCode: productCodeSchema,
      provider: z.enum(['stripe', 'apple', 'google']),
      status: z.enum(['active', 'cancel_at_period_end', 'withdrawn', 'expired', 'past_due']),
      startedAt: z.string(),
      currentPeriodEnd: z.string(),
      simulated: z.boolean(),
    })
    .nullable(),
  oneNightUntil: z.string().nullable(),
  credits: z.object({ spark: z.number(), spotlight: z.number(), paid_dm: z.number() }),
  invoices: z.array(
    z.object({
      id: z.string(),
      productCode: productCodeSchema,
      amountCents: z.number(),
      issuedAt: z.string(),
      status: z.enum(['paid', 'refunded']),
      url: z.string().nullable(),
      orderId: z.string().nullable().optional(),
    }),
  ),
  notifyMe: z.boolean(),
})
export function createPremiumService(db: Db): PremiumService {
  const state = async () => premiumStateSchema.parse(must(await db.rpc('premium_state')))
  const manage = async (action: string) => {
    const r = await db.functions.invoke('billing-account', { body: { action } })
    if (r.error || (r.data as { error?: string })?.error) throw new Error('gateway_error')
    return premiumStateSchema.parse(r.data)
  }
  return {
    getState: state,
    async startPurchase(code) {
      const r = await db.functions.invoke('create-checkout-session', { body: { code } })
      if (r.error) return err('gateway_error')
      const parsed = z.object({ url: z.url() }).safeParse(r.data)
      if (!parsed.success || new URL(parsed.data.url).hostname !== 'checkout.stripe.com')
        return err('gateway_error')
      return ok({ type: 'external', url: parsed.data.url })
    },
    async purchaseStatus(id) {
      const row = must(await db.from('purchase_orders').select('status').eq('id', id).maybeSingle())
      return z.enum(['pending', 'paid', 'refunded', 'expired']).parse(row?.status ?? 'pending')
    },
    async portal() {
      const r = await db.functions.invoke('billing-account', { body: { action: 'portal' } })
      const parsed = z.object({ url: z.url() }).safeParse(r.data)
      if (r.error || !parsed.success || new URL(parsed.data.url).hostname !== 'billing.stripe.com')
        throw new Error('gateway_error')
      return parsed.data.url
    },
    async completeTestPurchase(code) {
      return premiumStateSchema.parse(must(await db.rpc('simulate_billing', { p_code: code })))
    },
    cancel: () => manage('cancel'),
    resume: () => manage('resume'),
    async withdraw(orderId) {
      const r = await db.functions.invoke('request-withdrawal', { body: { orderId } })
      const context: unknown = (r.error as { context?: unknown } | null)?.context
      const value: unknown = context instanceof Response ? await context.json() : r.data
      if (z.object({ error: z.literal('window_closed') }).safeParse(value).success)
        return err('window_closed')
      if (r.error || (r.data as { error?: string })?.error) throw new Error('gateway_error')
      return ok(premiumStateSchema.parse(r.data))
    },
    async redeem(code) {
      const r = await db.rpc('premium_redeem', { p_code: code })
      if (r.error?.code === '54000') return err('rate_limited')
      const value = must(r) as {
        error?: 'invalid' | 'expired' | 'used'
        productCode?: string
        days?: number
      }
      if (value.error) return err(value.error)
      return ok(z.object({ productCode: productCodeSchema, days: z.number() }).parse(value))
    },
    async setNotifyMe(on) {
      return premiumStateSchema.parse(must(await db.rpc('premium_notify', { p_on: on })))
    },
    async sendPaidDm(personId, text) {
      const value = z
        .union([
          z.object({ error: z.enum(['disabled', 'no_credits', 'red_light']) }),
          z.object({ sent: z.literal(true) }),
        ])
        .parse(must(await db.rpc('premium_paid_dm', { p_person: personId, p_text: text })))
      return 'error' in value ? err(value.error) : ok(undefined)
    },
  }
}
