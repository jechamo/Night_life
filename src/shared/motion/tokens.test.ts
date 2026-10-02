import { describe, expect, it } from 'vitest'
import type { MotionProfile } from '@/shared/theme/themes'
import { DURATION_BOUNDS, getMotionTokens } from './tokens'

const PROFILES: MotionProfile[] = ['standard', 'expressive', 'calm', 'minimal']

describe('motion tokens (PRD 8.4)', () => {
  it.each(PROFILES)('%s keeps durations within 150-400 ms', (profile) => {
    for (const reduced of [false, true]) {
      const tokens = getMotionTokens(profile, reduced)
      for (const value of Object.values(tokens.duration)) {
        expect(value).toBeGreaterThanOrEqual(DURATION_BOUNDS.min)
        expect(value).toBeLessThanOrEqual(DURATION_BOUNDS.max)
      }
      for (const spring of Object.values(tokens.spring)) {
        const seconds = 'visualDuration' in spring ? spring.visualDuration : spring.duration
        expect(seconds).toBeGreaterThanOrEqual(DURATION_BOUNDS.min)
        expect(seconds).toBeLessThanOrEqual(DURATION_BOUNDS.max)
      }
    }
  })

  it('reduced motion turns every spring into a fade', () => {
    const tokens = getMotionTokens('standard', true)
    expect(tokens.reduced).toBe(true)
    expect(Object.values(tokens.spring).every((t) => t.type === 'tween')).toBe(true)
  })

  it('the Mono theme always behaves as reduced motion', () => {
    expect(getMotionTokens('minimal', false).reduced).toBe(true)
  })

  it('only the expressive profile glitches, and never when reduced', () => {
    expect(getMotionTokens('expressive', false).glitch).toBe(true)
    expect(getMotionTokens('expressive', true).glitch).toBe(false)
    expect(getMotionTokens('standard', false).glitch).toBe(false)
  })

  it('calm springs are slower and bounce less than standard ones', () => {
    const calm = getMotionTokens('calm', false).spring.bouncy
    const standard = getMotionTokens('standard', false).spring.bouncy
    expect(calm.bounce).toBeLessThan(standard.bounce ?? 0)
    expect(calm.visualDuration).toBeGreaterThan(standard.visualDuration ?? 0)
  })
})
