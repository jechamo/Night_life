import { useTranslation } from 'react-i18next'
import { ThemePreviewCard } from '@/features/themes/components/ThemePreviewCard'
import { useTheme } from '@/shared/theme/ThemeProvider'
import { THEME_IDS } from '@/shared/theme/themes'
import { useThemeSwitch } from '@/shared/theme/use-theme-switch'
import { Button } from '@/shared/ui/button'
import { OnboardingStepLayout } from '../components/OnboardingStepLayout'
import type { StepProps } from './types'

export function ThemeStep({
  dispatch,
  onFinish,
  finishing,
}: StepProps & { onFinish: () => void; finishing: boolean }) {
  const { t } = useTranslation()
  const { themeId } = useTheme()
  const switchTheme = useThemeSwitch()
  return (
    <OnboardingStepLayout
      step="theme"
      title={t('onboarding.theme.title')}
      description={t('onboarding.theme.body')}
      onBack={() => dispatch({ type: 'BACK' })}
      footer={
        <Button block size="lg" disabled={finishing} onClick={onFinish}>
          {t('onboarding.theme.finish')}
        </Button>
      }
    >
      <ul className="grid gap-3">
        {THEME_IDS.map((id) => (
          <li key={id}>
            <ThemePreviewCard themeId={id} selected={id === themeId} onSelect={switchTheme} />
          </li>
        ))}
      </ul>
    </OnboardingStepLayout>
  )
}
