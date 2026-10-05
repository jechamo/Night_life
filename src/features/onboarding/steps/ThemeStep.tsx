import { useTranslation } from 'react-i18next'
import { ThemePreviewCard } from '@/features/themes/components/ThemePreviewCard'
import { useTheme } from '@/shared/theme/ThemeProvider'
import { BASE_THEME_IDS } from '@/shared/theme/themes'
import { useThemeSwitch } from '@/shared/theme/use-theme-switch'
import { Button } from '@/shared/ui/button'
import { OnboardingStepLayout } from '../components/OnboardingStepLayout'
import type { StepProps } from './types'

export function ThemeStep({
  dispatch,
  onFinish,
  finishing,
  failed = false,
}: StepProps & { onFinish: () => void; finishing: boolean; failed?: boolean }) {
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
        <>
          {failed && (
            <p role="alert" className="mb-3 text-sm text-danger">
              {t('onboarding.theme.finishError')}
            </p>
          )}
          <Button block size="lg" disabled={finishing} onClick={onFinish}>
            {t('onboarding.theme.finish')}
          </Button>
        </>
      }
    >
      <ul className="grid gap-3">
        {BASE_THEME_IDS.map((id) => (
          <li key={id}>
            <ThemePreviewCard themeId={id} selected={id === themeId} onSelect={switchTheme} />
          </li>
        ))}
      </ul>
    </OnboardingStepLayout>
  )
}
