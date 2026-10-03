import { describe, expect, it } from 'vitest'
import { parseVenueCsv } from './venue-csv'

const SAMPLE = `name,type,city,address,lat,lng,price,hours,mon,tue,wed,thu,fri,sat,sun,phone,website,music,dress_code,min_age,description,source_url
"Sala, Sol",nightclub,Madrid,"Calle Mayor, 1",40.42,-3.70,3,Jue-Sáb,22:00-06:00,22:00-06:00,22:00-06:00,22:00-06:00,22:00-06:00,22:00-06:00,22:00-06:00,+34910000000,https://sala.example,techno;house,Sin chanclas,21,Dos salas.,https://www.google.com/maps/place/?q=place_id:abc
Sin sitio,bar,Madrid,Centro,,,,,€10-20,,,,,,,,,,Bar de copas.,https://www.google.com/maps/place/?q=place_id:def
Raro,cafe,Madrid,X,40.4,-3.7,,,,,,,,,,,,,,,
Lejos,beach club,Lisboa,X,,,,,,,,,,,,,,,,,
`

describe('parseVenueCsv', () => {
  it('keeps editorial fields and drops Google links, price ranges and unknown rows', () => {
    const parsed = parseVenueCsv(SAMPLE)
    expect(parsed.skipped).toBe(2)
    expect(parsed.rows).toHaveLength(2)
    expect(parsed.rows[0]).toMatchObject({
      name: 'Sala, Sol',
      type: 'nightclub',
      city: 'Madrid',
      address: 'Calle Mayor, 1',
      lat: 40.42,
      lng: -3.7,
      price: 3,
      phone: '+34910000000',
      website: 'https://sala.example',
      music: ['techno', 'house'],
      dressCode: 'Sin chanclas',
      minAge: 21,
      description: 'Dos salas.',
    })
    expect(parsed.rows[0]?.openingHours).toHaveLength(7)
    expect(JSON.stringify(parsed.rows)).not.toContain('google')
    expect(parsed.rows[1]).toMatchObject({
      name: 'Sin sitio',
      lat: null,
      lng: null,
      price: null,
      hours: '',
    })
  })
})
