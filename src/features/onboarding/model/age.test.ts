import { describe, expect, it } from 'vitest'
import { isAdult, validateBirthdate } from './age'

const today = new Date(2026, 9, 2) // 2 Oct 2026, local calendar day

describe('birthdate validation', () => {
  it('turns 18 exactly on the birthday', () => {
    const result = validateBirthdate('2008-10-02', today)
    expect(result).toEqual({ ok: true, age: 18 })
  })

  it('is still 17 the day before', () => {
    expect(validateBirthdate('2008-10-03', today)).toEqual({ ok: true, age: 17 })
    expect(isAdult(17)).toBe(false)
  })

  it('handles 29 February birthdays', () => {
    expect(validateBirthdate('2008-02-29', today)).toEqual({ ok: true, age: 18 })
  })

  it('rejects malformed, future and implausible dates', () => {
    expect(validateBirthdate('02/10/2000', today)).toEqual({ ok: false, error: 'invalid' })
    expect(validateBirthdate('2000-02-31', today)).toEqual({ ok: false, error: 'invalid' })
    expect(validateBirthdate('2030-01-01', today)).toEqual({ ok: false, error: 'future' })
    expect(validateBirthdate('1900-01-01', today)).toEqual({ ok: false, error: 'implausible' })
  })

  it('has no upper age limit for real ages', () => {
    expect(validateBirthdate('1940-05-05', today)).toEqual({ ok: true, age: 86 })
  })
})
