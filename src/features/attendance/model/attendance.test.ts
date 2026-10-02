import { describe, expect, it } from 'vitest'
import { checkInBlock, checkInExpiry, goingTonightWindow } from './attendance'

describe('"Esta Noche Voy" window (PRD 6.3)', () => {
  it('opens at 18:00 and expires at 06:00 next day', () => {
    const at = new Date(2026, 9, 3, 18, 30)
    const window = goingTonightWindow(at)
    expect(window.open).toBe(true)
    expect(window.expiresAt).toEqual(new Date(2026, 9, 4, 6, 0))
  })
  it('after midnight still counts as tonight', () => {
    const window = goingTonightWindow(new Date(2026, 9, 4, 2, 0))
    expect(window.open).toBe(true)
    expect(window.expiresAt).toEqual(new Date(2026, 9, 4, 6, 0))
  })
  it('closed during the day', () => {
    expect(goingTonightWindow(new Date(2026, 9, 3, 12, 0)).open).toBe(false)
  })
})

describe('check-in (PRD 6.3)', () => {
  const place = { lat: 40.42, lng: -3.7 }
  it('needs to be within 150 m', () => {
    expect(checkInBlock({ lat: 40.4209, lng: -3.7 }, place)).toBeNull()
    expect(checkInBlock({ lat: 40.422, lng: -3.7 }, place)).toBe('too_far')
    expect(checkInBlock(null, place)).toBe('no_location')
  })
  it('lasts 2 hours', () => {
    expect(checkInExpiry(new Date('2026-10-03T22:00:00Z')).toISOString()).toBe(
      '2026-10-04T00:00:00.000Z',
    )
  })
})
