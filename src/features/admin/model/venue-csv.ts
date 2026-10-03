import { CITIES, type OpeningPeriod } from '@/features/places/model/cities'
import { VENUE_TYPES, type VenueType } from '@/shared/domain/venue-types'

/** One catalogue row ready for `admin_import_catalogue`. Google URLs are never read. */
export interface CatalogueRow {
  name: string
  type: VenueType
  city: string
  address: string
  lat: number | null
  lng: number | null
  price: 1 | 2 | 3 | 4 | null
  hours: string
  openingHours: OpeningPeriod[]
  phone: string
  website: string
  music: string[]
  dressCode: string
  minAge: number | null
  description: string
}

export interface VenueCsvParse {
  rows: CatalogueRow[]
  /** Rows dropped before the server sees them (unknown type or city, empty name). */
  skipped: number
}

const TYPE_ALIASES: Record<string, VenueType> = {
  nightclub: 'nightclub',
  discoteca: 'nightclub',
  club: 'club',
  pub: 'pub',
  bar: 'bar',
  dive_bar: 'dive_bar',
  'dive bar': 'dive_bar',
  garito: 'dive_bar',
  lounge: 'lounge',
  terrace: 'terrace',
  terraza: 'terrace',
  beach_club: 'beach_club',
  'beach club': 'beach_club',
}

const DAY_COLUMNS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const SPAN = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/
const PHONE = /^\+?[0-9 ()-]{6,20}$/

/** RFC-style CSV: quoted commas, escaped quotes and either line ending. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const source = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += char
      continue
    }
    if (char === '"') quoted = true
    else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      if (row.some((value) => value.trim() !== '')) rows.push(row)
      row = []
    } else cell += char
  }
  row.push(cell)
  if (row.some((value) => value.trim() !== '')) rows.push(row)
  return rows
}

function spans(cell: string, day: number): OpeningPeriod[] {
  return cell
    .split(';')
    .map((part) => SPAN.exec(part.trim()))
    .flatMap((match) =>
      match ? [{ day, opens: `${match[1]}:${match[2]}`, closes: `${match[3]}:${match[4]}` }] : [],
    )
}

function column(header: string[], name: string): number {
  return header.findIndex((cell) => cell.trim().toLowerCase() === name)
}

function cell(row: string[], index: number): string {
  return index < 0 ? '' : (row[index] ?? '').trim()
}

/**
 * Editorial catalogue CSV. `source_url` is ignored on purpose: this research file
 * cites Google place links, and no Google content is stored (ADR 0010).
 * A row without coordinates can still update a venue of the same name and city.
 */
export function parseVenueCsv(text: string): VenueCsvParse {
  const table = parseCsv(text)
  const header = table[0]?.map((cell) => cell.trim().toLowerCase()) ?? []
  const nameAt = column(header, 'name')
  const typeAt = column(header, 'type')
  const cityAt = column(header, 'city')
  if (nameAt < 0 || typeAt < 0 || cityAt < 0) return { rows: [], skipped: 0 }
  const at = (name: string) => column(header, name)
  const rows: CatalogueRow[] = []
  let skipped = 0
  for (const raw of table.slice(1)) {
    const name = cell(raw, nameAt)
    const type = TYPE_ALIASES[cell(raw, typeAt).toLowerCase()]
    const city = CITIES.find((item) => item.name.toLowerCase() === cell(raw, cityAt).toLowerCase())
    if (
      name.length < 1 ||
      name.length > 80 ||
      !type ||
      !(VENUE_TYPES as readonly string[]).includes(type) ||
      !city
    ) {
      skipped++
      continue
    }
    const lat = Number(cell(raw, at('lat')))
    const lng = Number(cell(raw, at('lng')))
    const price = Number(cell(raw, at('price')))
    const phone = cell(raw, at('phone'))
    const website = cell(raw, at('website'))
    const minAge = Number(cell(raw, at('min_age')))
    const openingHours = DAY_COLUMNS.flatMap((day, index) => spans(cell(raw, at(day)), index))
    const hours = cell(raw, at('hours'))
    rows.push({
      name,
      type,
      city: city.name,
      address: cell(raw, at('address')).slice(0, 160),
      lat: Number.isFinite(lat) && cell(raw, at('lat')) !== '' ? lat : null,
      lng: Number.isFinite(lng) && cell(raw, at('lng')) !== '' ? lng : null,
      price: price === 1 || price === 2 || price === 3 || price === 4 ? price : null,
      hours: openingHours.length === 0 && hours.length <= 60 ? hours : '',
      openingHours: openingHours.length <= 14 ? openingHours : [],
      phone: PHONE.test(phone) ? phone : '',
      website: /^https:\/\/\S{3,290}$/.test(website) ? website : '',
      music: cell(raw, at('music'))
        .split(/[;,]/)
        .map((item) => item.trim())
        .filter((item) => item && item.length <= 30)
        .slice(0, 8),
      dressCode: cell(raw, at('dress_code')).slice(0, 80),
      minAge: Number.isInteger(minAge) && minAge >= 18 && minAge <= 25 ? minAge : null,
      description: cell(raw, at('description')).slice(0, 500),
    })
  }
  return { rows, skipped }
}
