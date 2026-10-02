import { describe, expect, it } from 'vitest'
import { composite, contrastRatio, parseColor } from './contrast'

describe('contrast helpers', () => {
  it('parses hex and rgba colours', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseColor('rgba(10, 20, 30, 0.5)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 })
  })

  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
  })

  it('composites translucent colours over the backdrop', () => {
    const result = composite(parseColor('rgba(255, 255, 255, 0.5)'), parseColor('#000000'))
    expect(result.r).toBeCloseTo(127.5)
  })

  it('rejects unsupported formats instead of guessing', () => {
    expect(() => parseColor('hsl(0 0% 0%)')).toThrow()
  })
})
