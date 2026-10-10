import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router'
import { usePaywallState } from '@/shared/flags/use-paywall-state'
import { Button, ButtonLink } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { CheckboxField } from '@/shared/ui/checkbox'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { StoreCheckout } from '../components/StoreCheckout'
import { useStartPurchase } from '../hooks/use-premium'
import { useStoreBilling } from '../hooks/use-store'
import { formatPrice, priceBreakdown, productByCode, WITHDRAWAL_DAYS } from '../model/catalog'

/**
 * Checkout with every legal detail before paying (PRD 6.13 point 5): price with VAT,
 * renewal, how to cancel and the right of withdrawal. Paying requires the express request
 * to start now, accepting the loss of withdrawal for what is used (TRLGDCU arts. 103/108).
 */
export function CheckoutScreen() {
  const { t, i18n } = useTranslation()
  const { code = '' } = useParams()
  const product = productByCode(code)
  const paywall = usePaywallState()
  const start = useStartPurchase()
  const store = useStoreBilling()
  const [immediateStart, setImmediateStart] = useState(false)
  if (!product || paywall !== 'checkout') return <Navigate to="/premium" replace />
  // Native app: the device's store sells it (Block 11b). The web keeps Stripe below.
  if (store.enabled)
    return (
      <>
        <ScreenHeader title={t('premium.checkout.title')} backTo="/premium" />
        <StoreCheckout product={product} />
      </>
    )
  const price = priceBreakdown(product)
  const money = (cents: number) => formatPrice(cents, i18n.language)
  const subscription = product.kind === 'subscription'
  const error = start.data && !start.data.ok ? start.data.error : null

  return (
    <>
      <ScreenHeader title={t('premium.checkout.title')} backTo="/premium" />
      <div className="px-safe mt-4 space-y-4 pb-6">
        <GlassCard className="space-y-2">
          <p className="font-display text-2xl font-semibold">
            {t(`premium.products.${product.code}.name`)}
          </p>
          <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
            <dt className="text-muted-foreground">{t('premium.checkout.net')}</dt>
            <dd>{money(price.netCents)}</dd>
            <dt className="text-muted-foreground">{t('premium.checkout.vat')}</dt>
            <dd>{money(price.vatCents)}</dd>
            <dt className="font-semibold">
              {subscription
                ? t('premium.checkout.totalPeriod', {
                    interval: t(`premium.intervals.${product.interval ?? 'month'}`),
                  })
                : t('premium.checkout.total')}
            </dt>
            <dd className="font-semibold text-primary">{money(price.totalCents)}</dd>
          </dl>
        </GlassCard>
        <ul className="space-y-2 text-sm">
          {subscription ? (
            <>
              <li>
                •{' '}
                {t('premium.checkout.renewalPeriod', {
                  price: money(price.totalCents),
                  interval: t(`premium.intervals.${product.interval ?? 'month'}`),
                })}
              </li>
              <li>• {t('premium.checkout.cancel')}</li>
            </>
          ) : (
            <li>
              •{' '}
              {product.kind === 'one_night'
                ? t('premium.checkout.oneNight')
                : t('premium.checkout.credits')}
            </li>
          )}
          <li>
            • {t(`premium.checkout.withdrawalRules.${product.kind}`, { days: WITHDRAWAL_DAYS })}
          </li>
          <li>• {t('premium.checkout.provider')}</li>
        </ul>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-success" aria-hidden />
          {t('premium.checkout.secure')}
        </p>
        <CheckboxField checked={immediateStart} onCheckedChange={setImmediateStart}>
          {t(`premium.checkout.immediateStart.${product.kind}`)}
        </CheckboxField>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {t(`premium.errors.${error}`)}
          </p>
        )}
        <Button
          block
          size="lg"
          disabled={start.isPending || !immediateStart}
          onClick={() => start.mutate({ code: product.code, consent: { immediateStart: true } })}
        >
          {subscription ? t('premium.checkout.subscribe') : t('premium.checkout.pay')}
        </Button>
        <ButtonLink to="/legal/premium" variant="ghost" size="sm" block>
          {t('premium.checkout.conditions')}
        </ButtonLink>
      </div>
    </>
  )
}
