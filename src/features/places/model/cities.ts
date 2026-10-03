import type { LatLng } from './types'

/** Launch cities (PRD 6.3). Centres are our own reference points, not provider data. */
export const CITIES = [
  { name: 'Madrid', center: { lat: 40.4168, lng: -3.7038 } },
  { name: 'Barcelona', center: { lat: 41.3874, lng: 2.1686 } },
  { name: 'Valencia', center: { lat: 39.4699, lng: -0.3763 } },
  { name: 'Sevilla', center: { lat: 37.3891, lng: -5.9845 } },
  { name: 'Málaga', center: { lat: 36.7213, lng: -4.4214 } },
  { name: 'Bilbao', center: { lat: 43.263, lng: -2.935 } },
  { name: 'Ibiza', center: { lat: 38.9067, lng: 1.4206 } },
  { name: 'Zaragoza', center: { lat: 41.6488, lng: -0.8891 } },
] as const satisfies readonly { name: string; center: LatLng }[]

export type CityName = (typeof CITIES)[number]['name']
export const DEFAULT_CITY: CityName = 'Madrid'

export const isCity = (value: string | null | undefined): value is CityName =>
  CITIES.some((c) => c.name === value)

export function cityCenter(name: string | null | undefined): LatLng | null {
  return CITIES.find((c) => c.name === name)?.center ?? null
}

/** Opening hours: Monday = 0 … Sunday = 6, local Europe/Madrid times "HH:MM". */
export interface OpeningPeriod {
  day: number
  opens: string
  closes: string
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function parseOpeningHours(raw: unknown): OpeningPeriod[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item: unknown): OpeningPeriod[] => {
    if (item === null || typeof item !== 'object') return []
    const { day, opens, closes } = item as Record<string, unknown>
    const d = Number(day)
    if (!Number.isInteger(d) || d < 0 || d > 6) return []
    if (typeof opens !== 'string' || typeof closes !== 'string') return []
    if (!TIME.test(opens) || !TIME.test(closes)) return []
    return [{ day: d, opens, closes }]
  })
}
