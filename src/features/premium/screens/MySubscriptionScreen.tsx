import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEntitlement } from '@/shared/entitlements/use-entitlement'
import { Badge } from '@/shared/ui/badge'
import { Button, ButtonLink } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Section } from '@/shared/ui/section'
import { useBillingPortal, usePremiumState, useSubscriptionActions } from '../hooks/use-premium'
import { WithdrawalSheet, type WithdrawalTarget } from '../components/WithdrawalSheet'
import { useStoreBilling } from '../hooks/use-store'
import { formatPrice, productByCode, withdrawalOpen } from '../model/catalog'

/**
 * "Mi suscripción" (PRD 6.13): cancel in 2 taps (here + confirm in the same card), the
 * withdrawal button always visible during the 14 days (the amount is shown before
 * confirming), invoices and credits. Venue purchases are B2B: no withdrawal button.
 */
export function MySubscriptionScreen() {
  const { t, i18n } = useTranslation()
  const { data: state } = usePremiumState()
  const { cancel, resume, withdraw } = useSubscriptionActions()
  const portal = useBillingPortal()
  const unlimited = useEntitlement('unlimited_likes').granted
  const store = useStoreBilling()
  const sub = state?.subscription
  // Block 11b: App Store / Google Play / Test Store subscriptions are managed in the store.
  const storeSub = !!sub && sub.provider !== 'stripe'
  // Captured once per visit: the one-night pass is re-checked by the server anyway.
  const [openedAt] = useState(() => Date.now())
  const [withdrawing, setWithdrawing] = useState<WithdrawalTarget | null>(null)
  const date = (iso: string) => new Date(iso).toLocaleDateString(i18n.language)
  const canWithdraw =
    sub && !storeSub && sub.status !== 'withdrawn' && withdrawalOpen(sub.startedAt, new Date())

  return (
    <>
      <ScreenHeader title={t('premium.mine.title')} backTo="/profile" />
      <div className="px-safe mt-4 space-y-3">
        {(cancel.isError || resume.isError || withdraw.isError || portal.isError) && (
          <p role="alert" className="text-danger">
            {t('premium.mine.actionFailed')}
          </p>
        )}
        {((sub && !sub.simulated && !storeSub) ||
          state?.invoices.some((i) => i.productCode === 'venue_pro_monthly')) && (
          <Button
            block
            variant="outline"
            disabled={portal.isPending}
            onClick={() => portal.mutate()}
          >
            {t('premium.mine.portal')}
          </Button>
        )}
        {sub ? (
          <GlassCard className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-xl font-semibold">
                {t(`premium.products.${sub.productCode}.name`)}
              </p>
              <Badge tone={sub.status === 'active' ? 'verified' : 'unconfirmed'}>
                {t(`premium.status.${sub.status}`)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {sub.status === 'cancel_at_period_end'
                ? t('premium.mine.endsOn', { date: date(sub.currentPeriodEnd) })
                : sub.status === 'active'
                  ? t('premium.mine.renewsOn', { date: date(sub.currentPeriodEnd) })
                  : t('premium.mine.ended')}
            </p>
            {storeSub && (
              <p className="text-sm text-muted-foreground">
                {t('premium.store.managed', {
                  store: t(
                    `premium.store.names.${sub.provider === 'apple' ? 'app_store' : sub.provider === 'google' ? 'play_store' : 'test_store'}`,
                  ),
                })}
              </p>
            )}
            {storeSub && store.enabled && (
              <Button
                variant="outline"
                block
                disabled={!store.ready || store.manage.isPending}
                onClick={() => store.manage.mutate()}
              >
                {t('premium.store.manage')}
              </Button>
            )}
            {storeSub && store.manage.data && !store.manage.data.ok && (
              <p className="text-xs text-muted-foreground">
                {t('premium.store.manageUnavailable')}
              </p>
            )}
            {!storeSub && sub.status === 'active' && (
              <Button
                variant="outline"
                block
                disabled={cancel.isPending}
                onClick={() => cancel.mutate()}
              >
                {t('premium.mine.cancel')}
              </Button>
            )}
            {!storeSub && sub.status === 'cancel_at_period_end' && (
              <Button
                variant="outline"
                block
                disabled={resume.isPending}
                onClick={() => resume.mutate()}
              >
                {t('premium.mine.resume')}
              </Button>
            )}
            {canWithdraw && (
              <Button
                variant="danger"
                block
                onClick={() => setWithdrawing({ productCode: sub.productCode })}
              >
                {t('premium.mine.withdraw')}
              </Button>
            )}
            {canWithdraw && (
              <p className="text-xs text-muted-foreground">{t('premium.mine.withdrawHint')}</p>
            )}
          </GlassCard>
        ) : (
          <GlassCard className="space-y-3">
            <p>{t('premium.mine.none')}</p>
            <ButtonLink to="/premium" size="sm">
              {t('premium.title')}
            </ButtonLink>
          </GlassCard>
        )}
        {state?.oneNightUntil && Date.parse(state.oneNightUntil) > openedAt && (
          <GlassCard>
            {t('premium.mine.oneNight', {
              time: new Date(state.oneNightUntil).toLocaleTimeString(i18n.language, {
                hour: '2-digit',
                minute: '2-digit',
              }),
            })}
          </GlassCard>
        )}
        {unlimited && <p className="text-sm text-live">{t('matching.likesUnlimited')}</p>}
      </div>
      <Section title={t('premium.mine.credits')}>
        <GlassCard className="grid grid-cols-3 gap-2 text-center">
          {(['spark', 'spotlight', 'paid_dm'] as const).map((kind) => (
            <div key={kind}>
              <p className="font-display text-2xl text-primary">{state?.credits[kind] ?? 0}</p>
              <p className="font-label text-xs text-muted-foreground">
                {t(`premium.creditKinds.${kind}`, { count: state?.credits[kind] ?? 0 })}
              </p>
            </div>
          ))}
        </GlassCard>
      </Section>
      <Section title={t('premium.mine.invoices')}>
        {state?.invoices.length ? (
          <ul className="glass divide-y divide-border rounded-theme">
            {state.invoices.map((invoice) => (
              <li
                key={invoice.id}
                className="flex items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <span>
                  {t(`premium.products.${invoice.productCode}.name`)} · {date(invoice.issuedAt)}
                </span>
                <span className={invoice.status === 'refunded' ? 'text-warning' : ''}>
                  {formatPrice(invoice.amountCents, i18n.language)}{' '}
                  {invoice.status === 'refunded' && `(${t('premium.mine.refunded')})`}
                </span>
                {invoice.status === 'paid' &&
                  invoice.orderId &&
                  // Subscriptions are withdrawn from their card; venue purchases are B2B.
                  ['credits', 'one_night'].includes(
                    productByCode(invoice.productCode)?.kind ?? '',
                  ) &&
                  withdrawalOpen(invoice.issuedAt, new Date()) && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        setWithdrawing({
                          orderId: invoice.orderId!,
                          productCode: invoice.productCode,
                        })
                      }
                    >
                      {t('premium.mine.withdraw')}
                    </Button>
                  )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t('premium.mine.noInvoices')}</p>
        )}
      </Section>
      <WithdrawalSheet
        target={withdrawing}
        onClose={() => setWithdrawing(null)}
        withdraw={withdraw}
      />
    </>
  )
}
