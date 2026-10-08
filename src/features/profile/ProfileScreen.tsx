import {
  CalendarCheck,
  BookOpen,
  Crown,
  Database,
  FileText,
  FlaskConical,
  Heart,
  LayoutDashboard,
  LogOut,
  Mail,
  Palette,
  RotateCcw,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  Store,
  ToggleLeft,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useResetOnboarding } from '@/features/onboarding/hooks/use-onboarding-status'
import { FeatureGate } from '@/shared/flags/FeatureGate'
import { usePaywallState } from '@/shared/flags/use-paywall-state'
import { hasRole } from '@/shared/session/roles'
import { useRoles } from '@/shared/session/use-roles'
import { useSignOut } from '@/shared/session/use-sign-out'
import { useServices } from '@/shared/services/ServicesProvider'
import { GlassCard } from '@/shared/ui/card'
import { ListRow } from '@/shared/ui/list-row'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Section } from '@/shared/ui/section'
import { MyProfileCard } from './components/MyProfileCard'
import { PreferencesSheet } from './components/PreferencesSheet'
import { IncognitoControl } from '@/features/premium/components/IncognitoControl'

function ActionRow({
  icon: Icon,
  label,
  hint,
  onClick,
  tone = 'text-primary',
}: {
  icon: typeof Heart
  label: string
  hint?: string
  onClick: () => void
  tone?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-opacity active:opacity-70"
    >
      <span
        className={`flex size-10 items-center justify-center rounded-full bg-surface-raised ${tone}`}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="flex-1">
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-sm text-muted-foreground">{hint}</span>}
      </span>
    </button>
  )
}

/** Perfil (PRD 5.3). Premium row follows the payment flags (PRD 6.13). */
export function ProfileScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const reset = useResetOnboarding()
  const paywall = usePaywallState()
  const isAdmin = hasRole(useRoles(), 'admin')
  const signOut = useSignOut()
  const { onboarding } = useServices()
  const [prefsOpen, setPrefsOpen] = useState(false)
  return (
    <>
      <ScreenHeader title={t('profile.title')} />
      <IncognitoControl />
      <MyProfileCard />
      <Section title={t('profileMenu.me')}>
        <GlassCard className="divide-y divide-border p-0">
          <ActionRow
            icon={Heart}
            label={t('profileMenu.preferences')}
            hint={t('profileMenu.preferencesHint')}
            onClick={() => setPrefsOpen(true)}
          />
          {paywall !== 'hidden' && (
            <ActionRow
              icon={Crown}
              tone="text-warning"
              label={t('profileMenu.premium')}
              hint={
                paywall === 'checkout' ? t('profileMenu.premiumCheckout') : t('common.comingSoon')
              }
              onClick={() => void navigate('/premium')}
            />
          )}
        </GlassCard>
      </Section>
      <Section title={t('profileMenu.privacy')}>
        <GlassCard className="divide-y divide-border p-0">
          <ListRow
            to="/profile/verification"
            icon={ShieldCheck}
            label={t('profileMenu.verification')}
            hint={t('profileMenu.verificationHint')}
          />
          <ListRow
            to="/profile/consents"
            icon={ToggleLeft}
            label={t('profileMenu.consents')}
            hint={t('profileMenu.consentsHint')}
          />
          <ListRow
            to="/profile/privacy"
            icon={Database}
            label={t('privacyData.title')}
            hint={t('profileMenu.privacyDataHint')}
          />
          <ListRow to="/profile/sos" icon={Siren} label={t('sos.title')} hint={t('sos.hint')} />
        </GlassCard>
      </Section>
      <Section title={t('profileMenu.account')}>
        <GlassCard className="p-0">
          <ActionRow
            icon={LogOut}
            tone="text-muted-foreground"
            label={t('profileMenu.signOut')}
            onClick={() =>
              signOut.mutate(undefined, {
                onSuccess: () => void navigate('/welcome', { replace: true }),
              })
            }
          />
        </GlassCard>
      </Section>
      <Section title={t('profile.appearance')}>
        <GlassCard className="divide-y divide-border p-0">
          <ListRow
            to="/profile/themes"
            icon={Palette}
            label={t('profile.themes')}
            hint={t('profile.themesHint')}
          />
          <ListRow
            to="/profile/settings"
            icon={SlidersHorizontal}
            label={t('profile.settings')}
            hint={t('profile.settingsHint')}
          />
        </GlassCard>
      </Section>
      <Section title={t('profileMenu.about')}>
        <GlassCard className="divide-y divide-border p-0">
          <FeatureGate flag="venue_bookings_enabled" is="on">
            <ListRow
              to="/reservas"
              icon={CalendarCheck}
              label={t('bookings.mine.title')}
              hint={t('bookings.mine.hint')}
            />
          </FeatureGate>
          <ListRow
            to="/guia"
            icon={BookOpen}
            label={t('guide.nav.user')}
            hint={t('guide.nav.userHint')}
          />
          <ListRow
            to="/legal"
            icon={FileText}
            label={t('profileMenu.legal')}
            hint={t('profileMenu.legalHint')}
          />
          <ListRow
            to="/legal/contact"
            icon={Mail}
            label={t('profileMenu.contact')}
            hint={t('publicWeb.contact.hint')}
          />
        </GlassCard>
      </Section>
      <Section title={t('profileMenu.business')}>
        <GlassCard className="divide-y divide-border p-0">
          <ListRow
            to="/venue"
            icon={Store}
            label={t('venuePanel.title')}
            hint={t('venuePanel.hint')}
          />
          {isAdmin && (
            <ListRow
              to="/admin"
              icon={LayoutDashboard}
              label={t('admin.title')}
              hint={t('profileMenu.adminHint')}
            />
          )}
        </GlassCard>
      </Section>
      {/* Test tools are double-gated: flag here (UI) and role + flag on the server (PRD 6.15 API5). */}
      <FeatureGate flag="test_tools_enabled" is="on">
        <Section title={t('profile.testing')}>
          <GlassCard className="divide-y divide-border p-0">
            <ListRow
              to="/dev/kit"
              icon={FlaskConical}
              label={t('profile.designKit')}
              hint={t('profile.designKitHint')}
            />
            {onboarding.testOtpCode && (
              <ActionRow
                icon={RotateCcw}
                tone="text-warning"
                label={t('profileMenu.resetOnboarding')}
                hint={t('profileMenu.resetOnboardingHint')}
                onClick={() =>
                  reset.mutate(undefined, {
                    onSuccess: () => void navigate('/welcome', { replace: true }),
                  })
                }
              />
            )}
          </GlassCard>
        </Section>
      </FeatureGate>
      <PreferencesSheet open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </>
  )
}
