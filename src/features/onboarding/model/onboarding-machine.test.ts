import { describe, expect, it } from 'vitest'
import { DEFAULT_CONSENTS } from '@/features/consents/model/consents'
import {
  defaultAgeRange,
  initialOnboardingState,
  onboardingReducer,
  type OnboardingEvent,
  type OnboardingState,
} from './onboarding-machine'

const today = new Date(2026, 9, 2)
const run = (events: OnboardingEvent[], from: OnboardingState = initialOnboardingState) =>
  events.reduce(onboardingReducer, from)

const profile = { name: 'Alex', gender: 'other' as const, bio: '', photos: [] }
const signed = [{ slug: 'terms' as const, version: '1.0', signedAt: '2026-10-02T20:00:00Z' }]
const happyPrefix: OnboardingEvent[] = [
  { type: 'BIRTHDATE_SUBMITTED', birthdate: '1995-06-15', today },
  { type: 'LEGAL_SIGNED', signed },
  { type: 'PHONE_VERIFIED', phone: '+34612345678' },
]

describe('onboarding machine (PRD 5.2)', () => {
  it('follows the mandatory order to completion', () => {
    const state = run([
      ...happyPrefix,
      { type: 'CONSENTS_SAVED', consents: { ...DEFAULT_CONSENTS, orientation: true } },
      { type: 'PROFILE_SAVED', profile },
      {
        type: 'PREFERENCES_SAVED',
        preferences: { interestedIn: ['women'], ageMin: 25, ageMax: 38 },
      },
      { type: 'THEME_CHOSEN', themeId: 'velvet' },
    ])
    expect(state.status).toBe('completed')
    if (state.status === 'completed') {
      expect(state.data.age).toBe(31)
      expect(state.data.themeId).toBe('velvet')
    }
  })

  it('under 18: stops and keeps no data at all', () => {
    const state = run([{ type: 'BIRTHDATE_SUBMITTED', birthdate: '2010-01-01', today }])
    expect(state).toEqual({ status: 'not_eligible' })
  })

  it('ignores invalid dates', () => {
    const state = run([{ type: 'BIRTHDATE_SUBMITTED', birthdate: 'nope', today }])
    expect(state).toEqual(initialOnboardingState)
  })

  it('cannot skip steps', () => {
    const state = run([{ type: 'PHONE_VERIFIED', phone: '+34612345678' }])
    expect(state).toEqual(initialOnboardingState)
  })

  it('"No acepto" pauses the flow and can be reviewed again', () => {
    const declined = run([happyPrefix[0]!, { type: 'LEGAL_DECLINED' }])
    expect(declined.status).toBe('legal_declined')
    const back = onboardingReducer(declined, { type: 'REVIEW_LEGAL_AGAIN' })
    expect(back).toMatchObject({ status: 'in_progress', step: 'legal' })
  })

  it('skips preferences without the orientation consent', () => {
    const state = run([
      ...happyPrefix,
      { type: 'CONSENTS_SAVED', consents: DEFAULT_CONSENTS },
      { type: 'PROFILE_SAVED', profile },
    ])
    expect(state).toMatchObject({ step: 'theme' })
    expect(onboardingReducer(state, { type: 'BACK' })).toMatchObject({ step: 'profile' })
  })

  it('cannot go back before the account exists once the phone is verified', () => {
    const state = run(happyPrefix)
    expect(onboardingReducer(state, { type: 'BACK' })).toBe(state)
  })

  it('suggests an age range around the user, inside 18-60+', () => {
    expect(defaultAgeRange(20)).toEqual({ ageMin: 18, ageMax: 27 })
    expect(defaultAgeRange(58)).toEqual({ ageMin: 51, ageMax: 60 })
  })
})
