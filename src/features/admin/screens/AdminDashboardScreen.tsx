import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { formatPrice } from '@/features/premium/model/catalog'
import { useServices } from '@/shared/services/ServicesProvider'
import { GlassCard } from '@/shared/ui/card'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { useAdminDashboard } from '../hooks/use-admin'

/** Admin dashboard (PRD 6.10): headline numbers and the queues waiting for a person. */
export function AdminDashboardScreen() {
  const { t, i18n } = useTranslation()
  const { data } = useAdminDashboard()
  const { admin } = useServices()
  const cards = data
    ? ([
        ['users', String(data.users), null],
        ['ageVerified', `${data.ageVerifiedPercent} %`, null],
        ['matchesToday', String(data.matchesToday), null],
        ['testRevenue', formatPrice(data.testRevenueCents, i18n.language), '/admin/payments'],
        ['pendingReports', String(data.pendingReports), '/admin/s/reports'],
        ['pendingVerifications', String(data.pendingVerifications), '/admin/s/verifications'],
        ['pendingClaims', String(data.pendingClaims), '/admin/s/claims'],
        ['openDataRequests', String(data.openDataRequests), '/admin/s/dataRequests'],
      ] as const)
    : []
  return (
    <>
      <ScreenHeader
        title={t('admin.nav.dashboard')}
        description={t(admin.mode === 'mock' ? 'admin.dashboard.body' : 'admin.dashboard.bodyLive')}
      />
      <div className="px-safe mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([key, value, to]) => {
          const content = (
            <GlassCard className="h-full">
              <p className="font-display text-3xl text-primary">{value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t(`admin.dashboard.${key}`)}</p>
            </GlassCard>
          )
          return to ? (
            <Link key={key} to={to} className="transition-opacity active:opacity-70">
              {content}
            </Link>
          ) : (
            <div key={key}>{content}</div>
          )
        })}
      </div>
    </>
  )
}
