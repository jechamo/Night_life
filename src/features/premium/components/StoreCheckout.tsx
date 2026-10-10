import { Store } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/shared/ui/badge'
import { Button, ButtonLink } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { usePremiumState } from '../hooks/use-premium'
import { useStoreBilling, useStoreProduct } from '../hooks/use-store'
import { formatPrice, priceBreakdown, type Product } from '../model/catalog'

/**
 * Native checkout (Block 11b): the device's store sells and bills the product, so the
 * store's own sheet carries price, renewal and refund terms. Benefits only change after
 * the server re-reads the purchase (store sync).
 */
export function StoreCheckout({ product }: Readonly<{ product: Product }>) {
  const { t, i18n } = useTranslation()
  const billing = useStoreBilling()
  const { data: state } = usePremiumState()
  const identifier = billing.productId(product.code)
  const { data: storeProduct } = useStoreProduct(identifier, product.code)
  const store = t(
    `premium.store.names.${billing.testing ? 'test_store' : (billing.storeName ?? 'test_store')}`,
  )
  const subscription = product.kind === 'subscription'
  const subscribed =
    subscription &&
    !!state?.subscription &&
    ['active', 'cancel_at_period_end', 'past_due'].includes(state.subscription.status)
  const result = billing.buy.data
  const failure = billing.failed ? 'unavailable' : result && !result.ok ? result.error : null
  const outcome = result?.ok ? result.value : null
  const price =
    storeProduct?.priceString ?? formatPrice(priceBreakdown(product).totalCents, i18n.language)

  return (
    <div className="px-safe mt-4 space-y-4 pb-6">
      <GlassCard className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-2xl font-semibold">
            {t(`premium.products.${product.code}.name`)}
          </p>
          {billing.testing && <Badge tone="unconfirmed">{t('premium.store.testing')}</Badge>}
        </div>
        <p className="font-semibold text-primary">{t('premium.store.storePrice', { price })}</p>
      </GlassCard>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Store className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        {t('premium.store.managedBy', { store })}
      </p>
      {subscribed && (
        <p role="alert" className="text-sm text-warning">
          {t('premium.store.errors.already_subscribed')}
        </p>
      )}
      {failure && (
        <p role="alert" className="text-sm text-danger">
          {t(`premium.store.errors.${failure}`)}
        </p>
      )}
      {outcome && (
        <p role="status" className="text-sm text-live">
          {t(`premium.store.${outcome}`)}
        </p>
      )}
      {outcome === 'done' ? (
        <ButtonLink to="/premium/subscription" block size="lg">
          {t('premium.mine.cta')}
        </ButtonLink>
      ) : (
        <Button
          block
          size="lg"
          disabled={!billing.ready || !identifier || subscribed || billing.buy.isPending}
          onClick={() => billing.buy.mutate(product.code)}
        >
          {billing.ready
            ? t(subscription ? 'premium.store.subscribe' : 'premium.store.buy', { store })
            : t('premium.store.loading')}
        </Button>
      )}
    </div>
  )
}
