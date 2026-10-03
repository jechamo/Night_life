import { describe, expect, it } from 'vitest'
import { applyFilters, DEFAULT_FILTERS } from './filters'
import { distanceMeters } from './geo'
import { placeSponsored } from './sponsored'
import { presentStats, vibeShares } from './stats'
import type { Place } from './types'

const place = (id: string, over: Partial<Place> = {}): Place => ({
  id,
  name: id,
  type: 'pub',
  location: { lat: 40.42, lng: -3.7 },
  address: 'Calle Falsa 1',
  price: 2,
  hours: '20:00-03:00',
  openNow: true,
  rating: 4,
  sponsored: false,
  stats: {
    people: 20,
    averageAge: 28,
    greenPercent: 50,
    ratio: { women: 50, men: 45, other: 5 },
    goingTonight: 3,
  },
  vibes: { fire: 0, music: 0, chill: 0, packed: 0, friendly: 0 },
  ...over,
})

describe('stats privacy (PRD 4.3)', () => {
  it('below 5 people only "less than 5" is shown', () => {
    const shown = presentStats({
      people: 4,
      averageAge: 22,
      greenPercent: 100,
      ratio: { women: 100, men: 0, other: 0 },
      goingTonight: 1,
    })
    expect(shown.people).toEqual({ kind: 'less_than', value: 5 })
    expect(shown.averageAge).toBeNull()
    expect(shown.greenPercent).toBeNull()
    expect(shown.ratio).toBeNull()
  })
  it('from 5 people everything is shown', () => {
    const shown = presentStats({
      people: 5,
      averageAge: 30,
      greenPercent: 40,
      ratio: null,
      goingTonight: 0,
    })
    expect(shown.people).toEqual({ kind: 'exact', value: 5 })
    expect(shown.averageAge).toBe(30)
  })
  it('vibe shares add up and sort', () => {
    expect(vibeShares({ fire: 3, music: 1, chill: 0 })).toEqual([
      { key: 'fire', percent: 75 },
      { key: 'music', percent: 25 },
      { key: 'chill', percent: 0 },
    ])
    expect(vibeShares({ fire: 0 })).toEqual([])
  })
})

describe('geo', () => {
  it('measures ~111 m per 0.001° of latitude', () => {
    expect(distanceMeters({ lat: 40, lng: -3 }, { lat: 40.001, lng: -3 })).toBeCloseTo(111, 0)
  })
})

describe('sponsored placement (PRD 6.5)', () => {
  it('max 2 on top, then 1 in every 5, extra sponsored dropped', () => {
    const list = [
      ...['s1', 's2', 's3', 's4', 's5'].map((id) => place(id, { sponsored: true })),
      ...['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8', 'o9'].map((id) => place(id)),
    ]
    expect(placeSponsored(list).map((p) => p.id)).toEqual([
      's1',
      's2',
      'o1',
      'o2',
      'o3',
      'o4',
      's3',
      'o5',
      'o6',
      'o7',
      'o8',
      's4',
      'o9',
    ])
  })
})

describe('filters', () => {
  const origin = { lat: 40.42, lng: -3.7 }
  it('age filter excludes places below the privacy threshold', () => {
    const few = place('few', {
      stats: { people: 3, averageAge: 25, greenPercent: null, ratio: null, goingTonight: 0 },
    })
    const result = applyFilters(
      [few, place('ok')],
      { ...DEFAULT_FILTERS, ageRange: [20, 35] },
      origin,
    )
    expect(result.map((p) => p.id)).toEqual(['ok'])
  })
  it('text search ignores accents and case', () => {
    const result = applyFilters(
      [place('Sala Ópera')],
      { ...DEFAULT_FILTERS, text: 'opera' },
      origin,
    )
    expect(result).toHaveLength(1)
  })
  it('sorts by people', () => {
    const a = place('a', { stats: { ...place('x').stats, people: 10 } })
    const b = place('b', { stats: { ...place('x').stats, people: 50 } })
    expect(
      applyFilters([a, b], { ...DEFAULT_FILTERS, sort: 'most_people' }, origin).map((p) => p.id),
    ).toEqual(['b', 'a'])
  })
  it('an unknown price only passes when no budget is set', () => {
    const unknown = place('unknown', { price: undefined })
    const cheap = place('cheap', { price: 1 })
    expect(applyFilters([unknown, cheap], DEFAULT_FILTERS, origin)).toHaveLength(2)
    expect(
      applyFilters([unknown, cheap], { ...DEFAULT_FILTERS, maxPrice: 2 }, origin).map((p) => p.id),
    ).toEqual(['cheap'])
  })
})
