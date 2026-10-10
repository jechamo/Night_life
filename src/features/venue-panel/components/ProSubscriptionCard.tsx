import { useTranslation } from 'react-i18next'
import { useBillingPortal } from '@/features/premium/hooks/use-premium'
import { useVenueCheckout } from '@/features/premium/hooks/use-store'
import { formatPrice, VENUE_PRICES } from '@/features/premium/model/catalog'
import { usePaywallState } from '@/shared/flags/use-paywall-state'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { useVenueBilling } from '../hooks/use-venue-panel'

export function ProSubscriptionCard({ placeId }: { placeId: string }) {
  const { t, i18n } = useTranslation()
  const { data } = useVenueBilling(placeId)
  const checkout = useVenueCheckout()
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
            // In the native app the store manages what it sold (Block 11b).
            onClick={() => (checkout.manage ? checkout.manage() : portal.mutate())}
          >
            {t('venuePanel.pro.manage')}
          </Button>
          {data.subscription.canManage === false && (
            <p className="text-xs text-muted-foreground">{t('venuePanel.pro.payerOnly')}</p>
          )}
        </>
      ) : (
        <Button
          disabled={!canBuy || checkout.pending}
          onClick={() => checkout.pay({ code: 'venue_pro_monthly', venueId: placeId })}
        >
          {t('premium.checkout.subscribe')}
        </Button>
      )}
      {!canBuy && <p className="text-sm text-muted-foreground">{t('premium.comingSoon.body')}</p>}
      {checkout.outcome && (
        <p role="status" className="text-sm text-live">
          {t(`premium.store.${checkout.outcome}`)}
        </p>
      )}
      {(checkout.failed || portal.isError) && (
        <p role="alert" className="text-danger">
          {t('venuePanel.billingError')}
        </p>
      )}
    </GlassCard>
  )
}
