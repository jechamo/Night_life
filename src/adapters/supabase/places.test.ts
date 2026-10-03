import { describe, expect, it, vi } from 'vitest'
import type { RealtimeEvent, RealtimeService } from '@/shared/realtime/realtime'
import { asStats, eventToPlace, venueToPlace } from './places'
import { mergeRealtime } from './realtime'

describe('Supabase places adapter', () => {
  it('keeps the server threshold: under 5 people there is no age, ratio or green', () => {
    const stats = asStats({ people: 4, averageAge: null, greenPercent: null, ratio: null })
    expect(stats).toEqual({
      people: 4,
      averageAge: null,
      greenPercent: null,
      ratio: null,
      goingTonight: 0,
    })
  })

  it('maps a catalogue venue with only our own editorial fields', () => {
    const place = venueToPlace(
      {
        id: 'v1',
        name: 'Sala',
        type: 'club',
        city: 'Madrid',
        lat: 40.42,
        lng: -3.7,
        price: 3,
        website: 'http://insecure.example',
        openingHours: [{ day: 4, opens: '23:00', closes: '06:00' }, { day: 9 }],
        music: ['Techno', ''],
        minAge: 21,
        people: 12,
        averageAge: 27.5,
        greenPercent: 40,
        ratio: { women: 50, men: 45, other: 5 },
      },
      'Descripción propia',
    )
    expect(place).toMatchObject({
      id: 'v1',
      type: 'club',
      city: 'Madrid',
      price: 3,
      description: 'Descripción propia',
      openingHours: [{ day: 4, opens: '23:00', closes: '06:00' }],
      music: ['Techno'],
      minAge: 21,
      stats: { people: 12, averageAge: 27.5, greenPercent: 40 },
    })
    expect(place?.website).toBeUndefined()
  })

  it('drops venues whose cached Google coordinates expired (ADR 0010)', () => {
    expect(venueToPlace({ id: 'v2', name: 'Sin coords', lat: null, lng: null })).toBeNull()
  })

  it('maps unknown event statuses to hidden', () => {
    const place = eventToPlace({
      id: 'e1',
      title: 'Fiesta',
      lat: 40.4,
      lng: -3.7,
      status: 'weird',
      startsAt: '2026-10-03T22:00:00Z',
      endsAt: '2026-10-04T04:00:00Z',
    })
    expect(place?.event?.status).toBe('hidden')
  })
})

describe('mergeRealtime', () => {
  it('uses real stats and ignores simulated place events', () => {
    const emitters: ((event: RealtimeEvent) => void)[] = []
    const source = (): RealtimeService => ({
      subscribe: (handler) => {
        emitters.push(handler)
        return () => {}
      },
    })
    const handler = vi.fn()
    mergeRealtime(source(), source()).subscribe(handler)
    const [real, simulated] = emitters
    const stats = asStats({ people: 6 })
    real?.({ type: 'stats', placeId: 'real', stats })
    simulated?.({ type: 'stats', placeId: 'mock', stats })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ type: 'stats', placeId: 'real', stats })
  })
})
