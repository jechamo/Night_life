import { Check, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'
import { cn } from '@/shared/lib/cn'
import { Badge } from '@/shared/ui/badge'
import { formatPrice, type Product } from '../model/catalog'

/** Honest product card (PRD 8.5): full price always visible, no fake urgency. */
export function ProductCard({
  product,
  selected,
  onSelect,
}: {
  product: Product
  selected: boolean
  onSelect: () => void
}) {
  const { t, i18n } = useTranslation()
  // Never sell a benefit that is not live yet: travel mode ships with Block 11.
  const travelMode = useFeatureFlag('travel_mode_enabled') === 'on'
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'relative w-full rounded-theme border p-4 text-left transition-opacity',
        selected ? 'border-primary bg-surface-raised shadow-[0_0_28px_var(--nl-glow)]' : 'glass',
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span>
          <span className="font-display block text-xl font-semibold">
            {t(`premium.products.${product.code}.name`)}
          </span>
          <span className="block text-sm text-muted-foreground">
            {t(`premium.products.${product.code}.tagline`)}
          </span>
        </span>
        <span className="text-right">
          <span className="font-display block text-xl font-semibold text-primary">
            {formatPrice(product.priceCents, i18n.language)}
          </span>
          <span className="font-label block text-xs text-muted-foreground">
            {product.interval ? t(`premium.intervals.${product.interval}`) : t('premium.oneTime')} ·{' '}
            {t('premium.vatIncluded')}
          </span>
        </span>
      </span>
      {product.highlighted && (
        <Badge tone="hereNow" className="absolute -top-2.5 left-4">
          {t('premium.mostComplete')}
        </Badge>
      )}
      {product.entitlements.length > 0 && (
        <ul className="mt-3 grid gap-1 text-sm">
          {product.entitlements.map((key) =>
            key === 'travel_mode' && !travelMode ? (
              <li key={key} className="flex items-center gap-2 text-muted-foreground">
                <Clock className="size-4" aria-hidden />
                {t('premium.benefitSoon', { benefit: t(`premium.benefits.${key}`) })}
              </li>
            ) : (
              <li key={key} className="flex items-center gap-2">
                <Check className="size-4 text-success" aria-hidden />
                {t(`premium.benefits.${key}`)}
              </li>
            ),
          )}
          {product.credits?.map((credit) => (
            <li key={credit.kind} className="flex items-center gap-2">
              <Check className="size-4 text-success" aria-hidden />
              {t(credit.perWeek ? 'premium.creditsPerWeek' : 'premium.credits', {
                count: credit.amount,
                kind: t(`premium.creditKinds.${credit.kind}`, { count: credit.amount }),
              })}
            </li>
          ))}
        </ul>
      )}
    </button>
  )
}
