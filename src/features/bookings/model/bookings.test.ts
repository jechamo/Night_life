import { describe, expect, it } from 'vitest'
import { arrivalFrom } from '../components/PlaceBookingSection'
import {
  formatGuestCode,
  guestQrPayload,
  isActiveReservation,
  normalizeGuestCode,
} from './bookings'

describe('roadmap R5: bookings model', () => {
  it('normalises what the door scans or types', () => {
    expect(normalizeGuestCode('NL:A1B2C3D4E5')).toBe('A1B2C3D4E5')
    expect(normalizeGuestCode('nl-a1b2c-3d4e5')).toBe('A1B2C3D4E5')
    expect(normalizeGuestCode(' A1B2C 3D4E5 ')).toBe('A1B2C3D4E5')
    expect(normalizeGuestCode('A1B2C3D4E')).toBeNull()
    expect(normalizeGuestCode('ZZZZZZZZZZ')).toBeNull()
  })

  it('formats the code and the QR payload', () => {
    expect(formatGuestCode('A1B2C3D4E5')).toBe('NL-A1B2C-3D4E5')
    expect(guestQrPayload('A1B2C3D4E5')).toBe('NL:A1B2C3D4E5')
    expect(normalizeGuestCode(guestQrPayload('A1B2C3D4E5'))).toBe('A1B2C3D4E5')
  })

  it('arrivals before 06:00 belong to the early hours after the chosen night', () => {
    const late = new Date(arrivalFrom('2026-10-09', '23:30')!)
    const early = new Date(arrivalFrom('2026-10-09', '01:30')!)
    expect(late.getDate()).toBe(9)
    expect(early.getDate()).toBe(10)
    expect(arrivalFrom('2026-10-09', '25:00')).toBeNull()
  })

  it('only future requested or accepted bookings are active', () => {
    const base = {
      id: 'r',
      placeId: 'v',
      party: 2,
      kind: 'table' as const,
      reason: null,
      arriveAt: new Date(Date.now() + 3_600_000).toISOString(),
    }
    expect(isActiveReservation({ ...base, status: 'requested' })).toBe(true)
    expect(isActiveReservation({ ...base, status: 'rejected' })).toBe(false)
    expect(
      isActiveReservation({ ...base, status: 'accepted', arriveAt: '2020-01-01T00:00:00Z' }),
    ).toBe(false)
  })
})
