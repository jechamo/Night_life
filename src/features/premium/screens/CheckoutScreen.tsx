import { ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router'
import { usePaywallState } from '@/shared/flags/use-paywall-state'
import { Button, ButtonLink } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { useStartPurchase } from '../hooks/use-premium'
import { formatPrice, priceBreakdown, productByCode, WITHDRAWAL_DAYS } from '../model/catalog'

/**
 * Checkout with every legal detail before paying (PRD 6.13 point 5): price with VAT,
 * renewal, how to cancel and the right of withdrawal. Button: "Suscribirme y pagar".
 */
export function CheckoutScreen() {
  const { t, i18n } = useTranslation()
  const { code = '' } = useParams()
  const product = productByCode(code)
  const paywall = usePaywallState()
  const start = useStartPurchase()
  if (!product || paywall !== 'checkout') return <Navigate to="/premium" replace />
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
              {subscription ? t('premium.checkout.totalMonthly') : t('premium.checkout.total')}
            </dt>
            <dd className="font-semibold text-primary">{money(price.totalCents)}</dd>
          </dl>
        </GlassCard>
        <ul className="space-y-2 text-sm">
          {subscription ? (
            <>
              <li>• {t('premium.checkout.renewal', { price: money(price.totalCents) })}</li>
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
          <li>• {t('premium.checkout.withdrawal', { days: WITHDRAWAL_DAYS })}</li>
          <li>• {t('premium.checkout.provider')}</li>
        </ul>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-success" aria-hidden />
          {t('premium.checkout.secure')}
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {t(`premium.errors.${error}`)}
          </p>
        )}
        <Button
          block
          size="lg"
          disabled={start.isPending}
          onClick={() => start.mutate(product.code)}
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
