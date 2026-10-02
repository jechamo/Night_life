import { format } from 'date-fns'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/button'
import { TextField } from '@/shared/ui/text-field'
import { OnboardingStepLayout } from '../components/OnboardingStepLayout'
import { validateBirthdate, type BirthdateError } from '../model/age'
import type { StepProps } from './types'

/**
 * Neutral age screen (PRD 5.2.2): empty by default and it does not reveal the
 * minimum age, so it doesn't invite people to lie. Under 18 → no account, no data.
 */
export function BirthdateStep({ data, dispatch }: StepProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState(data.birthdate ?? '')
  const [error, setError] = useState<BirthdateError | null>(null)
  const today = new Date()

  const submit = () => {
    const result = validateBirthdate(value, new Date())
    if (!result.ok) {
      setError(result.error)
      return
    }
    dispatch({ type: 'BIRTHDATE_SUBMITTED', birthdate: value, today: new Date() })
  }

  return (
    <OnboardingStepLayout
      step="birthdate"
      title={t('onboarding.birthdate.title')}
      description={t('onboarding.birthdate.body')}
      footer={
        <Button block size="lg" disabled={!value} onClick={submit}>
          {t('common.continue')}
        </Button>
      }
    >
      <TextField
        type="date"
        label={t('onboarding.birthdate.label')}
        value={value}
        max={format(today, 'yyyy-MM-dd')}
        onChange={(event) => {
          setValue(event.target.value)
          setError(null)
        }}
        error={error ? t(`onboarding.birthdate.errors.${error}`) : undefined}
        className="font-display text-lg"
      />
    </OnboardingStepLayout>
  )
}
