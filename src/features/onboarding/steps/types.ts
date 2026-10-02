import type { Dispatch } from 'react'
import type { OnboardingData, OnboardingEvent } from '../model/onboarding-machine'

export interface StepProps {
  data: OnboardingData
  dispatch: Dispatch<OnboardingEvent>
}
