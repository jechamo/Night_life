import {
  FlaskConical,
  Palette,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  ToggleLeft,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useResetOnboarding } from '@/features/onboarding/hooks/use-onboarding-status'
import { FeatureGate } from '@/shared/flags/FeatureGate'
import { GlassCard } from '@/shared/ui/card'
import { ListRow } from '@/shared/ui/list-row'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Section } from '@/shared/ui/section'

export function ProfileScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const reset = useResetOnboarding()
  return (
    <>
      <ScreenHeader title={t('profile.title')} description={t('app.slogan')} />
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
            <button
              type="button"
              disabled={reset.isPending}
              onClick={() =>
                reset.mutate(undefined, {
                  onSuccess: () => void navigate('/welcome', { replace: true }),
                })
              }
              className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-opacity active:opacity-70"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-surface-raised text-warning">
                <RotateCcw className="size-5" aria-hidden />
              </span>
              <span className="flex-1">
                <span className="block font-medium">{t('profileMenu.resetOnboarding')}</span>
                <span className="block text-sm text-muted-foreground">
                  {t('profileMenu.resetOnboardingHint')}
                </span>
              </span>
            </button>
          </GlassCard>
        </Section>
      </FeatureGate>
    </>
  )
}
