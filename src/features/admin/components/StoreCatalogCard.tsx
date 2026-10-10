import { useTranslation } from 'react-i18next'
import { formatPrice } from '@/features/premium/model/catalog'
import { useServices } from '@/shared/services/ServicesProvider'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { Section } from '@/shared/ui/section'
import { useStoreCatalogCheck } from '../hooks/use-admin'

/** Block 11b: read-only check of the RevenueCat Test Store catalogue against `plans`. */
export function StoreCatalogCard() {
  const { t, i18n } = useTranslation()
  const { admin } = useServices()
  const check = useStoreCatalogCheck()
  if (!admin.storeCatalog) return null
  const report = check.data
  const tone = (ok: boolean) => (ok ? 'verified' : 'unconfirmed')
  return (
    <Section title={t('admin.payments.store.title')}>
      <GlassCard className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('admin.payments.store.body')}</p>
        <Button
          size="sm"
          variant="outline"
          disabled={check.isPending}
          onClick={() => check.mutate(undefined)}
        >
          {t('admin.payments.store.check')}
        </Button>
        {check.isError && (
          <p role="alert" className="text-sm text-danger">
            {t('admin.payments.store.failed')}
          </p>
        )}
        {report && (
          <div className="space-y-2 text-sm">
            <p>
              {report.testStoreApp
                ? t('admin.payments.store.app', { name: report.testStoreApp.name })
                : t('admin.payments.store.noApp')}
            </p>
            <p className="flex items-center justify-between gap-2">
              {t('admin.payments.store.sdkKey')}
              <Badge tone={tone(report.sdkKeyMatches)}>
                {t(
                  report.sdkKeyMatches
                    ? 'admin.payments.store.ok'
                    : 'admin.payments.store.mismatch',
                )}
              </Badge>
            </p>
            <p className="flex items-center justify-between gap-2">
              {t('admin.payments.store.customers')}
              <Badge tone={tone(report.customers === 'ok')}>
                {t(
                  report.customers === 'ok'
                    ? 'admin.payments.store.ok'
                    : 'admin.payments.store.denied',
                )}
              </Badge>
            </p>
            <ul className="divide-y divide-border">
              {report.products.map((row) => (
                <li key={row.code} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    <code>{row.storeId ?? row.code}</code> ·{' '}
                    {formatPrice(row.priceCents, i18n.language)}
                  </span>
                  <Badge tone={tone(row.status === 'ok')}>
                    {t(`admin.payments.store.${row.status}`)}
                  </Badge>
                </li>
              ))}
            </ul>
            {report.extra.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('admin.payments.store.extra', { list: report.extra.join(', ') })}
              </p>
            )}
          </div>
        )}
      </GlassCard>
    </Section>
  )
}
