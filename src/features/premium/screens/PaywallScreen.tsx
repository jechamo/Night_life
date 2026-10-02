import { BellRing, Crown, Gift, Receipt } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useConsents } from '@/features/consents/hooks/use-consents'
import { usePaywallState } from '@/shared/flags/use-paywall-state'
import { Button, ButtonLink } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { EmptyState } from '@/shared/ui/empty-state'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Section } from '@/shared/ui/section'
import { Switch } from '@/shared/ui/switch'
import { ProductCard } from '../components/ProductCard'
import { usePremiumState, useSubscriptionActions } from '../hooks/use-premium'
import { CATALOG, type ProductCode } from '../model/catalog'

const FREE_KEYS = ['map', 'filters', 'verification', 'safety', 'profiles', 'chat', 'likes'] as const

/**
 * Paywall + Free/Premium comparison (PRD 6.13). What it shows depends only on the
 * flags: hidden, "Próximamente" (+ optional "Avísame") or the real checkout.
 */
export function PaywallScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const paywall = usePaywallState()
  const { data: state } = usePremiumState()
  const { data: consents } = useConsents()
  const { notifyMe } = useSubscriptionActions()
  const [selected, setSelected] = useState<ProductCode>('vip_monthly')

  if (paywall === 'hidden') {
    return (
      <>
        <ScreenHeader title={t('premium.title')} backTo="/profile" />
        <EmptyState
          icon={Crown}
          title={t('premium.hidden.title')}
          description={t('premium.hidden.body')}
        />
      </>
    )
  }

  const plans = CATALOG.filter((p) => p.kind !== 'credits')
  const extras = CATALOG.filter((p) => p.kind === 'credits')
  const marketing = consents?.choices.marketing ?? false

  return (
    <>
      <ScreenHeader
        title={t('premium.title')}
        description={t('premium.subtitle')}
        backTo="/profile"
      />
      <Section title={t('premium.freeTitle')}>
        <GlassCard>
          <ul className="grid gap-1 text-sm">
            {FREE_KEYS.map((key) => (
              <li key={key}>✓ {t(`premium.free.${key}`)}</li>
            ))}
          </ul>
        </GlassCard>
      </Section>
      <Section title={t('premium.plansTitle')}>
        <div className="grid gap-4 pt-2">
          {plans.map((product) => (
            <ProductCard
              key={product.code}
              product={product}
              selected={selected === product.code}
              onSelect={() => setSelected(product.code)}
            />
          ))}
        </div>
      </Section>
      <Section title={t('premium.extrasTitle')}>
        <div className="grid gap-3">
          {extras.map((product) => (
            <ProductCard
              key={product.code}
              product={product}
              selected={selected === product.code}
              onSelect={() => setSelected(product.code)}
            />
          ))}
        </div>
      </Section>
      <div className="px-safe mt-6 space-y-3 pb-6">
        {paywall === 'checkout' ? (
          <Button block size="lg" onClick={() => void navigate(`/premium/checkout/${selected}`)}>
            {t('premium.continue')}
          </Button>
        ) : (
          <GlassCard className="space-y-3">
            <p className="font-semibold">{t('premium.comingSoon.title')}</p>
            <p className="text-sm text-muted-foreground">{t('premium.comingSoon.body')}</p>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                <BellRing className="size-4 text-primary" aria-hidden />
                {t('premium.notifyMe')}
              </span>
              <Switch
                checked={state?.notifyMe ?? false}
                disabled={!marketing}
                onCheckedChange={(on) => notifyMe.mutate(on)}
                aria-label={t('premium.notifyMe')}
              />
            </label>
            {!marketing && (
              <p className="text-xs text-muted-foreground">{t('premium.notifyMeNeedsConsent')}</p>
            )}
          </GlassCard>
        )}
        <Button block variant="ghost" onClick={() => void navigate(-1)}>
          {t('premium.notNow')}
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <ButtonLink to="/premium/redeem" variant="outline" size="sm">
            <Gift aria-hidden />
            {t('premium.redeem.cta')}
          </ButtonLink>
          <ButtonLink to="/premium/subscription" variant="outline" size="sm">
            <Receipt aria-hidden />
            {t('premium.mine.cta')}
          </ButtonLink>
        </div>
      </div>
    </>
  )
}
