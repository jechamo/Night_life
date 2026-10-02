import type { ConsentChoices } from '@/features/consents/model/consents'
import type { SignedDocument } from '@/features/legal/model/legal'
import type { ThemeId } from '@/shared/theme/themes'
import { isAdult, validateBirthdate } from './age'

/**
 * Onboarding state machine (PRD 5.2, mandatory order). Explicit states as a
 * discriminated union; the server re-validates every transition from Block 5.
 * Personal data lives only in memory here: nothing is persisted client-side.
 */
export const ONBOARDING_STEPS = [
  'birthdate',
  'legal',
  'phone',
  'consents',
  'profile',
  'preferences',
  'theme',
] as const
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]

export type Gender = 'woman' | 'man' | 'non_binary' | 'other'
export type InterestedIn = 'women' | 'men' | 'non_binary'

export interface ProfileDraft {
  name: string
  gender: Gender
  bio: string
  photos: readonly Blob[]
}

export interface PreferencesDraft {
  interestedIn: readonly InterestedIn[]
  ageMin: number
  ageMax: number
}

export interface OnboardingData {
  birthdate?: string
  age?: number
  signed?: readonly SignedDocument[]
  phone?: string
  email?: string
  consents?: ConsentChoices
  city?: string
  profile?: ProfileDraft
  preferences?: PreferencesDraft
  themeId?: ThemeId
}

export type OnboardingState =
  | { status: 'in_progress'; step: OnboardingStep; data: OnboardingData }
  /** Under 18: no account is created and nothing is kept (PRD 5.2.2). */
  | { status: 'not_eligible' }
  /** "No acepto" on the signature screen. */
  | { status: 'legal_declined'; data: OnboardingData }
  | { status: 'completed'; data: OnboardingData }

export type OnboardingEvent =
  | { type: 'BIRTHDATE_SUBMITTED'; birthdate: string; today: Date }
  | { type: 'LEGAL_SIGNED'; signed: readonly SignedDocument[] }
  | { type: 'LEGAL_DECLINED' }
  | { type: 'REVIEW_LEGAL_AGAIN' }
  | { type: 'PHONE_VERIFIED'; phone: string; email?: string }
  | { type: 'CONSENTS_SAVED'; consents: ConsentChoices; city?: string }
  | { type: 'PROFILE_SAVED'; profile: ProfileDraft }
  | { type: 'PREFERENCES_SAVED'; preferences: PreferencesDraft }
  | { type: 'THEME_CHOSEN'; themeId: ThemeId }
  | { type: 'BACK' }

export const initialOnboardingState: OnboardingState = {
  status: 'in_progress',
  step: 'birthdate',
  data: {},
}

/**
 * Where "back" goes. Once the phone is verified the account exists, so the user
 * cannot go back to the pre-account steps (birthdate, legal, phone).
 */
const BACK_TARGET: Partial<Record<OnboardingStep, OnboardingStep>> = {
  legal: 'birthdate',
  phone: 'legal',
  profile: 'consents',
  preferences: 'profile',
}

const step = (s: OnboardingStep, data: OnboardingData): OnboardingState => ({
  status: 'in_progress',
  step: s,
  data,
})

/** Without the art. 9 orientation consent there are no preferences (and no matches). */
export const needsPreferences = (data: OnboardingData): boolean =>
  data.consents?.orientation === true

export function onboardingReducer(state: OnboardingState, event: OnboardingEvent): OnboardingState {
  if (state.status === 'legal_declined') {
    return event.type === 'REVIEW_LEGAL_AGAIN' ? step('legal', state.data) : state
  }
  if (state.status !== 'in_progress') return state
  const { data } = state

  switch (event.type) {
    case 'BIRTHDATE_SUBMITTED': {
      if (state.step !== 'birthdate') return state
      const result = validateBirthdate(event.birthdate, event.today)
      if (!result.ok) return state
      if (!isAdult(result.age)) return { status: 'not_eligible' }
      return step('legal', { ...data, birthdate: event.birthdate, age: result.age })
    }
    case 'LEGAL_SIGNED':
      return state.step === 'legal' ? step('phone', { ...data, signed: event.signed }) : state
    case 'LEGAL_DECLINED':
      return state.step === 'legal' ? { status: 'legal_declined', data } : state
    case 'PHONE_VERIFIED':
      return state.step === 'phone'
        ? step('consents', { ...data, phone: event.phone, email: event.email })
        : state
    case 'CONSENTS_SAVED': {
      if (state.step !== 'consents') return state
      const next: OnboardingData = { ...data, consents: event.consents, city: event.city }
      // Revoking orientation consent also drops any preferences already typed.
      if (!event.consents.orientation) delete next.preferences
      return step('profile', next)
    }
    case 'PROFILE_SAVED': {
      if (state.step !== 'profile') return state
      const next = { ...data, profile: event.profile }
      return step(needsPreferences(next) ? 'preferences' : 'theme', next)
    }
    case 'PREFERENCES_SAVED':
      return state.step === 'preferences'
        ? step('theme', { ...data, preferences: event.preferences })
        : state
    case 'THEME_CHOSEN':
      return state.step === 'theme'
        ? { status: 'completed', data: { ...data, themeId: event.themeId } }
        : state
    case 'BACK': {
      if (state.step === 'theme')
        return step(needsPreferences(data) ? 'preferences' : 'profile', data)
      const target = BACK_TARGET[state.step]
      return target ? step(target, data) : state
    }
    default:
      return state
  }
}

/** 1-based position for the progress indicator. */
export const stepNumber = (s: OnboardingStep): number => ONBOARDING_STEPS.indexOf(s) + 1

/** Sensible default range around the user's age, clamped to 18-60+ (PRD 2.2, 6.5). */
export function defaultAgeRange(age: number): { ageMin: number; ageMax: number } {
  return { ageMin: Math.max(18, age - 7), ageMax: Math.min(60, age + 7) }
}
