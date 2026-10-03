import { overpassQuery, parseOsmOpeningHours, toVenue } from './osm.ts'

function assertEquals(actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a !== b) throw new Error(`expected ${b}, got ${a}`)
}

Deno.test('opening hours: day ranges, lists, overnight and off', () => {
  assertEquals(parseOsmOpeningHours('Mo-We 18:00-02:00; Fr,Sa 20:00-06:00; Su off'), [
    { day: 0, opens: '18:00', closes: '02:00' },
    { day: 1, opens: '18:00', closes: '02:00' },
    { day: 2, opens: '18:00', closes: '02:00' },
    { day: 4, opens: '20:00', closes: '06:00' },
    { day: 5, opens: '20:00', closes: '06:00' },
  ])
})

Deno.test('opening hours: times past midnight and wrapping day ranges', () => {
  assertEquals(parseOsmOpeningHours('Sa-Mo 23:00-27:30'), [
    { day: 0, opens: '23:00', closes: '03:30' },
    { day: 5, opens: '23:00', closes: '03:30' },
    { day: 6, opens: '23:00', closes: '03:30' },
  ])
})

Deno.test('opening hours: later rules override, holidays ignored', () => {
  assertEquals(parseOsmOpeningHours('12:00-01:00; Su off; PH off'), [
    { day: 0, opens: '12:00', closes: '01:00' },
    { day: 1, opens: '12:00', closes: '01:00' },
    { day: 2, opens: '12:00', closes: '01:00' },
    { day: 3, opens: '12:00', closes: '01:00' },
    { day: 4, opens: '12:00', closes: '01:00' },
    { day: 5, opens: '12:00', closes: '01:00' },
  ])
})

Deno.test('opening hours: unsupported syntax yields nothing', () => {
  assertEquals(parseOsmOpeningHours('Jun-Sep Mo-Su 20:00-04:00'), [])
  assertEquals(parseOsmOpeningHours('Mo-Fr 25:00-02:00'), [])
  assertEquals(parseOsmOpeningHours(''), [])
})

Deno.test('venue mapping keeps only safe fields', () => {
  const venue = toVenue({
    type: 'way',
    id: 42,
    center: { lat: 40.42, lon: -3.7 },
    tags: {
      amenity: 'biergarten',
      name: 'Terraza Sol',
      'addr:street': 'Calle Mayor',
      'addr:housenumber': '5',
      website: 'http://insecure.example',
      phone: '+34 910 000 000;+34 600 000 000',
      'music:genre': 'techno;house;yes',
      min_age: '30',
      opening_hours: 'Mo-Su 12:00-02:00',
    },
  })
  assertEquals(venue?.ref, 'way/42')
  assertEquals(venue?.type, 'terrace')
  assertEquals(venue?.address, 'Calle Mayor 5')
  assertEquals(venue?.website, '')
  assertEquals(venue?.phone, '+34 910 000 000')
  assertEquals(venue?.music, ['techno', 'house'])
  assertEquals(venue?.minAge, null)
  assertEquals(venue?.hours, '')
  assertEquals(venue?.openingHours.length, 7)
})

Deno.test('venue mapping drops unnamed, unknown or disused places', () => {
  assertEquals(toVenue({ type: 'node', id: 1, lat: 1, lon: 1, tags: { amenity: 'bar' } }), null)
  assertEquals(
    toVenue({ type: 'node', id: 1, lat: 1, lon: 1, tags: { amenity: 'cafe', name: 'X' } }),
    null,
  )
  assertEquals(
    toVenue({
      type: 'node',
      id: 1,
      lat: 1,
      lon: 1,
      tags: { amenity: 'bar', name: 'X', disused: 'yes' },
    }),
    null,
  )
})

Deno.test('overpass query only for launch cities', () => {
  assertEquals(overpassQuery('Lisboa'), null)
  assertEquals(overpassQuery('Madrid')?.includes('around:12000,40.4168,-3.7038'), true)
})
