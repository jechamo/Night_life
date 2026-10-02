import { describe, expect, it } from 'vitest'
import { CONSENT_DEFINITIONS, DEFAULT_CONSENTS, ONBOARDING_CONSENTS } from './consents'

describe('consents (PRD 6.1)', () => {
  it('nothing is pre-ticked', () => {
    expect(Object.values(DEFAULT_CONSENTS).every((value) => !value)).toBe(true)
  })

  it('orientation is the only art. 9 consent asked at onboarding', () => {
    expect(CONSENT_DEFINITIONS.filter((c) => c.special).map((c) => c.key)).toEqual(['orientation'])
  })

  it('every consent has a definition', () => {
    expect(CONSENT_DEFINITIONS.map((c) => c.key)).toEqual([...ONBOARDING_CONSENTS])
  })
})
