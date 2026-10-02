import { FlaskConical, Palette, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { FeatureGate } from '@/shared/flags/FeatureGate'
import { GlassCard } from '@/shared/ui/card'
import { ListRow } from '@/shared/ui/list-row'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Section } from '@/shared/ui/section'

export function ProfileScreen() {
  const { t } = useTranslation()
  return (
    <>
      <ScreenHeader title={t('profile.title')} description={t('app.slogan')} />
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
          <GlassCard className="p-0">
            <ListRow
              to="/dev/kit"
              icon={FlaskConical}
              label={t('profile.designKit')}
              hint={t('profile.designKitHint')}
            />
          </GlassCard>
        </Section>
      </FeatureGate>
    </>
  )
}
