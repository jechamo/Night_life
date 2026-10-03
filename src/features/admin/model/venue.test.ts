import { describe, expect, it } from 'vitest'
import { venueInputErrors, type VenueInput } from './venue'

const valid: VenueInput = {
  name: 'Sala Demo',
  type: 'club',
  city: 'Madrid',
  address: 'Calle Mayor 1',
  description: '',
  hours: '',
  price: 2,
  phone: '+34 600 000 000',
  website: 'https://example.com',
  music: [],
  dressCode: '',
  minAge: null,
  notes: '',
  openingHours: [{ day: 4, opens: '23:00', closes: '06:00' }],
  lat: 40.42,
  lng: -3.7,
}

describe('venueInputErrors', () => {
  it('accepts a complete venue', () => {
    expect(venueInputErrors(valid)).toEqual([])
  })

  it('mirrors the server rules', () => {
    expect(
      venueInputErrors({
        ...valid,
        name: 'X',
        lat: Number.NaN,
        website: 'http://example.com',
        minAge: 30,
        openingHours: [{ day: 7, opens: '25:00', closes: '06:00' }],
      }),
    ).toEqual(['name', 'lat', 'website', 'minAge', 'openingHours'])
  })
})
