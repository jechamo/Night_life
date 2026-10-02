import { describe, expect, it } from 'vitest'
import { AGE_GATED_ACTIONS, canPerform, classifyPhotoMatch, UNVERIFIED } from './verification'

describe('age gate (PRD 5.2.10)', () => {
  it('blocks every flirting action until the age is verified', () => {
    for (const action of AGE_GATED_ACTIONS) {
      expect(canPerform(action, UNVERIFIED)).toBe(false)
      expect(canPerform(action, undefined)).toBe(false)
    }
  })

  it('blocks while pending, in review, failed or after a "possible minor" report', () => {
    const states = [
      { state: 'pending', providerSessionId: 'x' },
      { state: 'manual_review', reason: 'requested' },
      { state: 'failed', canRequestReview: true },
      { state: 'reverification_required', reason: 'possible_minor_report' },
    ] as const
    for (const age of states) expect(canPerform('like', { ...UNVERIFIED, age })).toBe(false)
  })

  it('allows once verified', () => {
    const snapshot = {
      ...UNVERIFIED,
      age: { state: 'verified', verifiedAt: '2026-10-02T21:00:00Z' },
    } as const
    expect(canPerform('chat', snapshot)).toBe(true)
  })
})

describe('photo match thresholds (PRD 6.2 level 2)', () => {
  it.each([
    [0.92, 'verified'],
    [0.85, 'manual_review'],
    [0.6, 'manual_review'],
    [0.59, 'not_matched'],
    [Number.NaN, 'not_matched'],
  ])('%s → %s', (score, expected) => {
    expect(classifyPhotoMatch(score)).toBe(expected)
  })
})
