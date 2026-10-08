import { useTranslation } from 'react-i18next'
import { useBillingPortal, useStartVenuePurchase } from '@/features/premium/hooks/use-premium'
import { formatPrice, VENUE_PRICES } from '@/features/premium/model/catalog'
import { usePaywallState } from '@/shared/flags/use-paywall-state'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { useVenueBilling } from '../hooks/use-venue-panel'

export function ProSubscriptionCard({ placeId }: { placeId: string }) {
  const { t, i18n } = useTranslation()
  const { data } = useVenueBilling(placeId)
  const start = useStartVenuePurchase()
  const portal = useBillingPortal(placeId)
  const canBuy = usePaywallState() === 'checkout'
  return (
    <GlassCard className="mt-3 space-y-3">
      <p className="font-semibold">{t('venuePanel.pro.title')}</p>
      <p className="text-sm text-muted-foreground">{t('venuePanel.pro.body')}</p>
      <p>
        {formatPrice(VENUE_PRICES.pro, i18n.language)} {t('premium.intervals.month')} ·{' '}
        {t('premium.vatIncluded')}
      </p>
      <p className="text-xs text-muted-foreground">{t('venuePanel.pro.billingTerms')}</p>
      {data?.proSource === 'contract' ? (
        <p role="status">{t('venuePanel.pro.contract')}</p>
      ) : data?.subscription &&
        ['active', 'cancel_at_period_end', 'past_due'].includes(data.subscription.status) ? (
        <>
          <p role="status">{t(data.pro ? 'venuePanel.pro.active' : 'venuePanel.pro.inactive')}</p>
          <Button
            variant="outline"
            disabled={portal.isPending || data.subscription.canManage === false}
            onClick={() => portal.mutate()}
          >
            {t('venuePanel.pro.manage')}
          </Button>
          {data.subscription.canManage === false && (
            <p className="text-xs text-muted-foreground">{t('venuePanel.pro.payerOnly')}</p>
          )}
        </>
      ) : (
        <Button
          disabled={!canBuy || start.isPending}
          onClick={() => start.mutate({ code: 'venue_pro_monthly', venueId: placeId })}
        >
          {t('premium.checkout.subscribe')}
        </Button>
      )}
      {!canBuy && <p className="text-sm text-muted-foreground">{t('premium.comingSoon.body')}</p>}
      {(start.isError || portal.isError || (start.data && !start.data.ok)) && (
        <p role="alert" className="text-danger">
          {t('venuePanel.billingError')}
        </p>
      )}
    </GlassCard>
  )
}
