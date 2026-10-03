// OpenStreetMap → own catalogue (ADR 0010). Data © OpenStreetMap contributors, ODbL:
// the venue keeps its OSM reference and the app shows the attribution.

export const OSM_CITIES: Record<string, { lat: number; lng: number }> = {
  Madrid: { lat: 40.4168, lng: -3.7038 },
  Barcelona: { lat: 41.3874, lng: 2.1686 },
  Valencia: { lat: 39.4699, lng: -0.3763 },
  Sevilla: { lat: 37.3891, lng: -5.9845 },
  Málaga: { lat: 36.7213, lng: -4.4214 },
  Bilbao: { lat: 43.263, lng: -2.935 },
  Ibiza: { lat: 38.9067, lng: 1.4206 },
  Zaragoza: { lat: 41.6488, lng: -0.8891 },
}

export const OSM_RADIUS_M = 12_000

const AMENITY_TYPE: Record<string, 'nightclub' | 'pub' | 'bar' | 'terrace'> = {
  nightclub: 'nightclub',
  pub: 'pub',
  bar: 'bar',
  biergarten: 'terrace',
}

export function overpassQuery(city: string): string | null {
  const center = OSM_CITIES[city]
  if (!center) return null
  const around = `around:${OSM_RADIUS_M},${center.lat},${center.lng}`
  return `[out:json][timeout:90];nwr["amenity"~"^(nightclub|pub|bar|biergarten)$"]["name"](${around});out center tags;`
}

export interface OsmElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

export interface OsmVenue {
  ref: string
  name: string
  type: 'nightclub' | 'pub' | 'bar' | 'terrace'
  lat: number
  lng: number
  address: string
  phone: string
  website: string
  hours: string
  openingHours: OpeningPeriod[]
  music: string[]
  minAge: number | null
}

export interface OpeningPeriod {
  day: number
  opens: string
  closes: string
}

const PHONE = /^\+?[0-9 ()-]{6,20}$/
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const RANGE = /^([0-2]?\d):([0-5]\d)-([0-4]?\d):([0-5]\d)\+?$/

const first = (value: string | undefined) => (value ?? '').split(';')[0]?.trim() ?? ''

function days(selector: string): number[] | null {
  const out = new Set<number>()
  for (const part of selector.split(',')) {
    const [from, to] = part.split('-')
    const a = DAYS.indexOf(from ?? '')
    const b = to === undefined ? a : DAYS.indexOf(to)
    if (a < 0 || b < 0) return null
    for (let d = a; ; d = (d + 1) % 7) {
      out.add(d)
      if (d === b) break
    }
  }
  return [...out]
}

function time(h: string, m: string): string | null {
  const hours = Number(h)
  if (hours > 48) return null
  return `${String(hours % 24).padStart(2, '0')}:${m}`
}

/**
 * The common subset of the OSM `opening_hours` syntax ("Mo-Th 18:00-02:00; Fr,Sa
 * 20:00-06:00; Su off"). Anything richer (months, holidays, weeks…) yields nothing:
 * better no timetable than a wrong one.
 */
export function parseOsmOpeningHours(raw: string | undefined): OpeningPeriod[] {
  const value = (raw ?? '').trim()
  if (!value || value.length > 255) return []
  if (value === '24/7') return DAYS.map((_, day) => ({ day, opens: '00:00', closes: '23:59' }))
  const byDay = new Map<number, OpeningPeriod[]>()
  for (const rule of value
    .split(';')
    .map((r) => r.trim())
    .filter(Boolean)) {
    if (/^(PH|SH)\b/.test(rule)) continue
    const match = /^((?:[A-Z][a-z](?:-[A-Z][a-z])?)(?:,[A-Z][a-z](?:-[A-Z][a-z])?)*)?\s*(.*)$/.exec(
      rule,
    )
    if (!match) return []
    const selected = match[1] ? days(match[1]) : [0, 1, 2, 3, 4, 5, 6]
    const times = (match[2] ?? '').trim()
    if (!selected) return []
    if (times === 'off' || times === 'closed') {
      for (const d of selected) byDay.delete(d)
      continue
    }
    const periods: { opens: string; closes: string }[] = []
    for (const span of times.split(',')) {
      const r = RANGE.exec(span.trim())
      const opens = r ? time(r[1]!, r[2]!) : null
      const closes = r ? time(r[3]!, r[4]!) : null
      if (!opens || !closes || Number(r![1]) > 23) return []
      periods.push({ opens, closes })
    }
    if (periods.length === 0) return []
    for (const d of selected)
      byDay.set(
        d,
        periods.map((p) => ({ day: d, ...p })),
      )
  }
  const all = [...byDay.keys()].sort((a, b) => a - b).flatMap((d) => byDay.get(d) ?? [])
  return all.length <= 14 ? all : []
}

export function toVenue(element: OsmElement): OsmVenue | null {
  const tags = element.tags ?? {}
  const type = AMENITY_TYPE[tags.amenity ?? '']
  const name = (tags.name ?? '').trim()
  const lat = element.lat ?? element.center?.lat
  const lng = element.lon ?? element.center?.lon
  if (!type || !name || name.length > 80 || lat === undefined || lng === undefined) return null
  if (!['node', 'way', 'relation'].includes(element.type)) return null
  if (tags.disused === 'yes' || tags.abandoned === 'yes' || tags.opening_hours === 'closed')
    return null
  const street = (tags['addr:street'] ?? '').trim()
  const number = (tags['addr:housenumber'] ?? '').trim()
  const phone = first(tags.phone ?? tags['contact:phone'])
  const website = first(tags.website ?? tags['contact:website'])
  const hours = (tags.opening_hours ?? '').trim()
  const openingHours = parseOsmOpeningHours(hours)
  const minAge = Number(tags.min_age)
  return {
    ref: `${element.type}/${element.id}`,
    name,
    type,
    lat,
    lng,
    address: street ? `${street}${number ? ` ${number}` : ''}`.slice(0, 160) : '',
    phone: PHONE.test(phone) ? phone : '',
    website: /^https:\/\/\S{3,290}$/.test(website) ? website : '',
    hours: openingHours.length === 0 && hours.length <= 60 ? hours : '',
    openingHours,
    music: (tags['music:genre'] ?? tags.music ?? '')
      .split(';')
      .map((m) => m.trim())
      .filter((m) => m && m !== 'yes' && m !== 'no' && m.length <= 30)
      .slice(0, 8),
    minAge: Number.isInteger(minAge) && minAge >= 18 && minAge <= 25 ? minAge : null,
  }
}
