import { describe, expect, it } from 'vitest'
import {
  change,
  formatEuros,
  hasExtras,
  EMPTY_EXTRAS,
  parseEuros,
  usedPhotoSlots,
} from './showcase'

describe('roadmap R4: showcase model', () => {
  it('parses euros with comma or dot, up to the maximum', () => {
    expect(parseEuros('', 1000)).toBeNull()
    expect(parseEuros('0', 1000)).toBe(0)
    expect(parseEuros('9,50', 1000)).toBe(950)
    expect(parseEuros('9.5', 1000)).toBe(950)
    expect(parseEuros('10.01', 1000)).toBe('invalid')
    expect(parseEuros('9.999', 1000)).toBe('invalid')
    expect(parseEuros('-1', 1000)).toBe('invalid')
    expect(parseEuros('abc', 1000)).toBe('invalid')
  })

  it('formats whole euros without decimals', () => {
    expect(formatEuros(1000)).toBe('10')
    expect(formatEuros(950)).toBe('9,50')
  })

  it('compares periods only above the privacy threshold', () => {
    expect(change(30, 20)).toBe(50)
    expect(change(4, 20)).toBeNull()
    expect(change(30, 0)).toBeNull()
  })

  it('rejected photos do not use a slot; empty details show nothing', () => {
    const photo = (status: 'pending' | 'approved' | 'rejected') => ({
      id: status,
      url: '',
      status,
      reason: null,
      isCover: false,
      createdAt: '',
      visible: false,
    })
    expect(usedPhotoSlots([photo('pending'), photo('approved'), photo('rejected')])).toBe(2)
    expect(hasExtras(null)).toBe(false)
    expect(hasExtras(EMPTY_EXTRAS)).toBe(false)
    expect(hasExtras({ ...EMPTY_EXTRAS, terrace: true })).toBe(true)
  })
})
