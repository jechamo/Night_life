import { describe, expect, it } from 'vitest'
import { canCreateEvent, evaluateEvent, isDuplicateEvent } from './events'

const now = new Date('2026-10-03T22:00:00Z')
const base = {
  status: 'unconfirmed' as const,
  createdAt: '2026-10-03T12:00:00Z',
  endsAt: '2026-10-04T04:00:00Z',
  confirmations: 0,
  fakeReports: 0,
}

describe('event life cycle (PRD 6.7)', () => {
  it('3 distinct confirmations confirm it', () => {
    expect(evaluateEvent({ ...base, confirmations: 3 }, now)).toBe('confirmed')
  })
  it('is deleted if not confirmed within 24 h', () => {
    expect(evaluateEvent(base, new Date('2026-10-04T12:00:00Z'))).toBe('archived')
    expect(
      evaluateEvent({ ...base, endsAt: '2026-10-06T00:00:00Z' }, new Date('2026-10-04T12:00:00Z')),
    ).toBe('deleted')
  })
  it('3 "fake" reports hide it for review', () => {
    expect(evaluateEvent({ ...base, status: 'confirmed', fakeReports: 3 }, now)).toBe('hidden')
  })
  it('finished events are archived', () => {
    expect(evaluateEvent({ ...base, status: 'confirmed' }, new Date('2026-10-04T05:00:00Z'))).toBe(
      'archived',
    )
  })
  it('only age-verified users, max 2 a day', () => {
    expect(canCreateEvent(false, 0)).toBe('not_verified')
    expect(canCreateEvent(true, 2)).toBe('daily_limit')
    expect(canCreateEvent(true, 1)).toBeNull()
  })
  it('detects duplicates: same spot, overlapping time, similar title', () => {
    const existing = [
      {
        title: 'Fiesta techno en la plaza',
        location: { lat: 40.42, lng: -3.7 },
        startsAt: '2026-10-03T22:00:00Z',
        endsAt: '2026-10-04T02:00:00Z',
      },
    ]
    const dup = {
      title: 'Techno plaza',
      location: { lat: 40.4203, lng: -3.7 },
      startsAt: '2026-10-03T23:00:00Z',
      endsAt: '2026-10-04T03:00:00Z',
    }
    expect(isDuplicateEvent(dup, existing)).toBe(true)
    expect(isDuplicateEvent({ ...dup, location: { lat: 40.43, lng: -3.7 } }, existing)).toBe(false)
  })
})
