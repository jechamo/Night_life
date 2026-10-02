import {
  BadgeCheck,
  Ban,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  FlaskConical,
  Gauge,
  Megaphone,
  Scale,
  Settings2,
  ShieldAlert,
  Store,
  ToggleRight,
  UserCheck,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, NavLink, Outlet } from 'react-router'
import { hasRole } from '@/shared/session/roles'
import { useRolesState } from '@/shared/session/use-roles'
import { cn } from '@/shared/lib/cn'
import { Button, ButtonLink } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { TextField } from '@/shared/ui/text-field'
import { useMfaSession } from '../hooks/use-admin'

type NavKey =
  | 'dashboard'
  | 'verifications'
  | 'reports'
  | 'appeals'
  | 'bans'
  | 'claims'
  | 'events'
  | 'sponsorships'
  | 'payments'
  | 'flags'
  | 'testTools'
  | 'dataRequests'
  | 'legalDocs'
  | 'settings'
  | 'audit'

const NAV: readonly { key: NavKey; to: string; icon: LucideIcon }[] = [
  { key: 'dashboard', to: '/admin', icon: Gauge },
  { key: 'verifications', to: '/admin/s/verifications', icon: UserCheck },
  { key: 'reports', to: '/admin/s/reports', icon: ShieldAlert },
  { key: 'appeals', to: '/admin/s/appeals', icon: Scale },
  { key: 'bans', to: '/admin/s/bans', icon: Ban },
  { key: 'claims', to: '/admin/s/claims', icon: Store },
  { key: 'events', to: '/admin/s/events', icon: CalendarDays },
  { key: 'sponsorships', to: '/admin/s/sponsorships', icon: Megaphone },
  { key: 'payments', to: '/admin/payments', icon: CreditCard },
  { key: 'flags', to: '/admin/flags', icon: ToggleRight },
  { key: 'testTools', to: '/admin/test-tools', icon: FlaskConical },
  { key: 'dataRequests', to: '/admin/s/dataRequests', icon: BadgeCheck },
  { key: 'legalDocs', to: '/admin/s/legalDocs', icon: FileText },
  { key: 'settings', to: '/admin/settings', icon: Settings2 },
  { key: 'audit', to: '/admin/s/audit', icon: ClipboardList },
]

function MfaGate() {
  const { t } = useTranslation()
  const { verify } = useMfaSession()
  const [code, setCode] = useState('')
  return (
    <main className="pt-safe px-safe flex min-h-dvh items-center justify-center bg-background">
      <GlassCard className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">{t('admin.mfa.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('admin.mfa.body')}</p>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            verify.mutate(code)
          }}
        >
          <TextField
            label={t('admin.mfa.code')}
            hint={t('admin.mfa.hint')}
            error={verify.data === false ? t('admin.mfa.wrong') : undefined}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <Button type="submit" block disabled={code.length !== 6 || verify.isPending}>
            {t('admin.mfa.verify')}
          </Button>
        </form>
        <ButtonLink to="/profile" variant="ghost" block>
          {t('admin.exit')}
        </ButtonLink>
      </GlassCard>
    </main>
  )
}

/**
 * Admin frame (PRD 6.10): role `admin` + second factor (PRD 6.12 E). The guard is a UI
 * hint only; from Block 5 every admin RPC re-checks role + MFA (aal2) on the server.
 */
export function AdminLayout() {
  const { t } = useTranslation()
  const { roles, isPending } = useRolesState()
  const { verified } = useMfaSession()
  if (isPending) return <div className="min-h-dvh bg-background" aria-busy="true" />
  if (!hasRole(roles, 'admin')) return <Navigate to="/profile" replace />
  if (!verified) return <MfaGate />

  return (
    <div className="min-h-dvh bg-background text-foreground lg:flex">
      <aside className="pt-safe border-border lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-r">
        <div className="px-safe flex items-center justify-between gap-2 py-3 lg:px-4">
          <p className="font-display text-lg font-semibold">{t('admin.title')}</p>
          <ButtonLink to="/profile" variant="ghost" size="sm">
            {t('admin.exit')}
          </ButtonLink>
        </div>
        <nav
          aria-label={t('admin.navLabel')}
          className="px-safe flex gap-2 overflow-x-auto pb-3 lg:flex-col lg:gap-1 lg:px-2"
        >
          {NAV.map(({ key, to, icon: Icon }) => (
            <NavLink
              key={key}
              to={to}
              end={to === '/admin'}
              className={({ isActive }) =>
                cn(
                  'font-label flex min-h-11 shrink-0 items-center gap-2 rounded-full px-3 text-sm whitespace-nowrap transition-opacity lg:rounded-theme',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              <Icon className="size-4" aria-hidden />
              {t(`admin.nav.${key}`)}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main id="main" className="min-w-0 flex-1 pb-12">
        <div className="mx-auto w-full max-w-4xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
