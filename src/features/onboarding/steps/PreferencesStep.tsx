import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/button'
import { MultiChoice } from '@/shared/ui/choice-group'
import { RangeSlider } from '@/shared/ui/range-slider'
import { OnboardingStepLayout } from '../components/OnboardingStepLayout'
import { defaultAgeRange, type InterestedIn } from '../model/onboarding-machine'
import type { StepProps } from './types'

const OPTIONS: readonly InterestedIn[] = ['women', 'men', 'non_binary']
export const AGE_FLOOR = 18
export const AGE_CEILING = 60

/** Only reached with the explicit orientation consent (PRD 5.2.7). Nothing preselected. */
export function PreferencesStep({ data, dispatch }: StepProps) {
  const { t } = useTranslation()
  const initialRange = data.preferences ?? defaultAgeRange(data.age ?? 30)
  const [interestedIn, setInterestedIn] = useState<InterestedIn[]>([
    ...(data.preferences?.interestedIn ?? []),
  ])
  const [range, setRange] = useState<[number, number]>([initialRange.ageMin, initialRange.ageMax])
  const [tried, setTried] = useState(false)

  const submit = () => {
    setTried(true)
    if (interestedIn.length === 0) return
    dispatch({
      type: 'PREFERENCES_SAVED',
      preferences: { interestedIn, ageMin: range[0], ageMax: range[1] },
    })
  }

  return (
    <OnboardingStepLayout
      step="preferences"
      title={t('onboarding.preferences.title')}
      description={t('onboarding.preferences.body')}
      onBack={() => dispatch({ type: 'BACK' })}
      footer={
        <Button block size="lg" onClick={submit}>
          {t('common.continue')}
        </Button>
      }
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('onboarding.preferences.interestedIn')}</legend>
        <MultiChoice<InterestedIn>
          label={t('onboarding.preferences.interestedIn')}
          value={interestedIn}
          onChange={setInterestedIn}
          options={OPTIONS.map((o) => ({
            value: o,
            label: t(`onboarding.preferences.options.${o}`),
          }))}
        />
        {tried && interestedIn.length === 0 && (
          <p role="alert" className="text-sm text-danger">
            {t('onboarding.preferences.interestedInError')}
          </p>
        )}
      </fieldset>
      <RangeSlider
        label={t('onboarding.preferences.age')}
        thumbLabels={[t('onboarding.preferences.ageMin'), t('onboarding.preferences.ageMax')]}
        min={AGE_FLOOR}
        max={AGE_CEILING}
        value={range}
        onChange={setRange}
        formatValue={(n) => (n >= AGE_CEILING ? `${AGE_CEILING}+` : String(n))}
      />
    </OnboardingStepLayout>
  )
}
