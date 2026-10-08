import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES, type Language } from '@/i18n'
import { useLanguage } from '@/i18n/use-language'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'
import { useMotionPreferences } from '@/shared/motion/MotionPreferencesProvider'
import { useTheme } from '@/shared/theme/ThemeProvider'
import { GlassCard } from '@/shared/ui/card'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Section } from '@/shared/ui/section'
import { SegmentedControl } from '@/shared/ui/segmented-control'
import { Switch } from '@/shared/ui/switch'
import { AccountEmailSection } from './components/AccountEmailSection'

export function SettingsScreen() {
  const { t } = useTranslation()
  const { reduceMotionSetting, setReduceMotionSetting, systemPrefersReduced } =
    useMotionPreferences()
  const { theme } = useTheme()
  const { language, setLanguage } = useLanguage()
  const switchId = useId()
  const descriptionId = useId()
  const emailLogin = useFeatureFlag('email_login_enabled') === 'on'

  return (
    <>
      <ScreenHeader title={t('settings.title')} backTo="/profile" />
      <Section title={t('profile.appearance')}>
        <GlassCard>
          <div className="flex items-center gap-4">
            <label htmlFor={switchId} className="flex-1 cursor-pointer py-1">
              <span className="block font-medium">{t('settings.reduceMotion.label')}</span>
              <span id={descriptionId} className="block text-sm text-muted-foreground">
                {t('settings.reduceMotion.description')}
              </span>
            </label>
            <Switch
              id={switchId}
              aria-describedby={descriptionId}
              checked={reduceMotionSetting}
              onCheckedChange={setReduceMotionSetting}
            />
          </div>
          {systemPrefersReduced && (
            <p className="mt-3 text-sm text-live">{t('settings.reduceMotion.systemActive')}</p>
          )}
          {theme.motion === 'minimal' && (
            <p className="mt-3 text-sm text-live">{t('settings.reduceMotion.themeActive')}</p>
          )}
        </GlassCard>
      </Section>
      <Section title={t('settings.language.label')}>
        <SegmentedControl<Language>
          label={t('settings.language.label')}
          value={language}
          onChange={setLanguage}
          options={LANGUAGES.map((lng) => ({ value: lng, label: t(`settings.language.${lng}`) }))}
        />
      </Section>
      {emailLogin && <AccountEmailSection />}
    </>
  )
}
