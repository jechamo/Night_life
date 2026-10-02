import { goingTonightWindow } from '@/features/attendance/model/attendance'
import {
  productByCode,
  transitionSubscription,
  normalizePromoCode,
  PROMO_CODE_RE,
  withdrawalOpen,
} from '@/features/premium/model/catalog'
import type { PremiumService, PremiumState } from '@/features/premium/services/premium-service'
import type { EntitlementKey } from '@/shared/entitlements/entitlements'
import { canPurchase } from '@/shared/flags/paywall'
import { err, ok } from '@/shared/lib/result'
import type { MockConfig } from './config'

type Wait = () => Promise<void>

export function createMockPremiumService(
  config: MockConfig,
  wait: Wait,
  deps: { isRedLight: (personId: string) => boolean },
): PremiumService {
  const state = (): PremiumState => structuredClone(config.premium)
  const grant = (keys: readonly EntitlementKey[], source: 'stripe' | 'promo', endsAt: string) => {
    const startsAt = new Date().toISOString()
    config.entitlements = [
      ...config.entitlements.filter((e) => !(keys.includes(e.key) && e.source === source)),
      ...keys.map((key) => ({ key, source, status: 'active' as const, startsAt, endsAt })),
    ]
  }
  const revoke = (source: 'stripe') => {
    config.entitlements = config.entitlements.map((e) =>
      e.source === source ? { ...e, status: 'revoked' as const } : e,
    )
  }
  const logEvent = (type: string) =>
    config.rows.paymentEvents.unshift({
      id: `evt_test_${Date.now()}`,
      title: type,
      subtitle: 'Stripe (test) · idempotente',
      status: 'processed',
      createdAt: new Date().toISOString(),
      facts: ['test'],
    })

  return {
    getState: () => Promise.resolve(state()),
    async startPurchase(code) {
      await wait()
      const product = productByCode(code)
      if (!product || config.flags.payments_mode === 'disabled') return err('payments_disabled')
      if (!canPurchase(config.flags, config.roles)) return err('not_allowed')
      if (
        product.kind === 'subscription' &&
        config.premium.subscription &&
        config.premium.subscription.status !== 'withdrawn' &&
        config.premium.subscription.status !== 'expired'
      )
        return err('already_subscribed')
      // Real adapter: Edge Function `create-checkout-session` → Stripe Checkout URL (allowlisted).
      return ok({ type: 'internal', path: `/premium/test-checkout/${code}` })
    },
    async completeTestPurchase(code) {
      await wait()
      const product = productByCode(code)
      if (!product) return state()
      const now = new Date()
      const endsAt =
        product.kind === 'subscription'
          ? new Date(now.getTime() + 30 * 86_400_000).toISOString()
          : product.kind === 'one_night'
            ? goingTonightWindow(now).expiresAt.toISOString()
            : null
      if (endsAt) grant(product.entitlements, 'stripe', endsAt)
      if (product.kind === 'subscription') {
        config.premium.subscription = {
          id: `sub_test_${Date.now()}`,
          productCode: product.code,
          provider: 'stripe',
          status: 'active',
          startedAt: now.toISOString(),
          currentPeriodEnd: endsAt!,
        }
      }
      if (product.kind === 'one_night') config.premium.oneNightUntil = endsAt
      for (const credit of product.credits ?? [])
        config.premium.credits[credit.kind] += credit.amount
      config.premium.invoices = [
        {
          id: `in_test_${Date.now()}`,
          productCode: product.code,
          amountCents: product.priceCents,
          issuedAt: now.toISOString(),
          status: 'paid',
        },
        ...config.premium.invoices,
      ]
      logEvent('checkout.session.completed')
      return state()
    },
    async cancel() {
      await wait()
      if (config.premium.subscription)
        config.premium.subscription = transitionSubscription(
          config.premium.subscription,
          'cancel',
          new Date(),
        )
      logEvent('customer.subscription.updated')
      return state()
    },
    async resume() {
      await wait()
      if (config.premium.subscription)
        config.premium.subscription = transitionSubscription(
          config.premium.subscription,
          'resume',
          new Date(),
        )
      return state()
    },
    async withdraw() {
      await wait()
      const sub = config.premium.subscription
      if (!sub || !withdrawalOpen(sub.startedAt, new Date())) return err('window_closed')
      config.premium.subscription = transitionSubscription(sub, 'withdraw', new Date())
      revoke('stripe')
      config.premium.invoices = config.premium.invoices.map((inv, i) =>
        i === 0 ? { ...inv, status: 'refunded' } : inv,
      )
      logEvent('charge.refunded')
      return ok(state())
    },
    async redeem(raw) {
      await wait()
      if (++config.redeemAttempts > 5) return err('rate_limited')
      const code = normalizePromoCode(raw)
      const promo = config.promoCodes.find((p) => p.code === code)
      if (!PROMO_CODE_RE.test(code) || !promo) return err('invalid')
      if (Date.parse(promo.expiresAt) < Date.now()) return err('expired')
      if (promo.uses >= promo.maxUses) return err('used')
      promo.uses += 1
      const product = productByCode(promo.productCode)
      if (product)
        grant(
          product.entitlements,
          'promo',
          new Date(Date.now() + promo.days * 86_400_000).toISOString(),
        )
      return ok({ productCode: product?.code ?? 'pass_monthly', days: promo.days })
    },
    async setNotifyMe(on) {
      await wait()
      config.premium.notifyMe = on
      return state()
    },
    async sendPaidDm(personId) {
      await wait()
      if (config.flags.paid_dm_enabled !== 'on') return err('disabled')
      if (deps.isRedLight(personId)) return err('red_light')
      if (config.premium.credits.paid_dm <= 0) return err('no_credits')
      config.premium.credits.paid_dm -= 1
      return ok(undefined)
    },
  }
}
