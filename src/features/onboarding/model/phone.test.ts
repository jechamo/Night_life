import { describe, expect, it } from 'vitest'
import { isOtpFormat, maskPhone, toE164 } from './phone'

describe('phone helpers', () => {
  it('normalises Spanish mobiles to E.164', () => {
    expect(toE164('+34', '612 34 56 78')).toBe('+34612345678')
    expect(toE164('+34', '612-345-678')).toBe('+34612345678')
  })

  it('rejects letters and too-short numbers', () => {
    expect(toE164('+34', '61234abc')).toBeNull()
    expect(toE164('+34', '123')).toBeNull()
  })

  it('masks all but the last three digits', () => {
    expect(maskPhone('+34612345678')).toBe('+34 ••• ••• 678')
  })

  it('accepts only 6-digit codes', () => {
    expect(isOtpFormat('123456')).toBe(true)
    expect(isOtpFormat('12345')).toBe(false)
    expect(isOtpFormat('12a456')).toBe(false)
  })
})
