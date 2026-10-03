// OpenStreetMap catalogue import (ADR 0010, owner authorisation 2026-10-03). Admin + aal2
// only, re-checked by the RPC with the caller's JWT. Overpass is free and keyless; the
// response is bounded, validated and mapped before anything reaches the database.
import { json, preflight } from '../_shared/http.ts'
import { overpassQuery, toVenue, type OsmElement, type OsmVenue } from '../_shared/osm.ts'
import { boundedJson, boundedText } from '../_shared/request-body.ts'
import { requireUser } from '../_shared/supabase.ts'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const USER_AGENT = 'NightlifeConnect/0.1 (venue catalogue import)'
const MAX_RESPONSE_BYTES = 25_000_000
const MAX_VENUES = 6000

function rpcStatus(message: string): number {
  if (message.includes('rate limited')) return 429
  if (message.includes('forbidden')) return 403
  return 400
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

function asElement(value: unknown): OsmElement | null {
  if (!isRecord(value) || typeof value.type !== 'string' || typeof value.id !== 'number')
    return null
  const tags = isRecord(value.tags)
    ? Object.fromEntries(
        Object.entries(value.tags).filter(
          (e): e is [string, string] => typeof e[1] === 'string' && e[1].length <= 300,
        ),
      )
    : {}
  const center = isRecord(value.center) ? value.center : null
  return {
    type: value.type,
    id: value.id,
    lat: typeof value.lat === 'number' ? value.lat : undefined,
    lon: typeof value.lon === 'number' ? value.lon : undefined,
    center:
      center && typeof center.lat === 'number' && typeof center.lon === 'number'
        ? { lat: center.lat, lon: center.lon }
        : undefined,
    tags,
  }
}

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)

  const auth = await requireUser(req)
  if (!auth) return json(req, { error: 'unauthorized' }, 401)

  let city = ''
  try {
    const body = await boundedJson(req, 1024)
    city = isRecord(body) && typeof body.city === 'string' ? body.city : ''
  } catch {
    return json(req, { error: 'bad_request' }, 400)
  }
  const query = overpassQuery(city)
  if (!query) return json(req, { error: 'bad_request' }, 400)

  // Empty import = permission + rate-limit check before touching the third party.
  const guard = await auth.db.rpc('admin_import_osm_venues', { p_city: city, p_items: [] })
  if (guard.error) {
    return json(req, { error: 'forbidden' }, rpcStatus(guard.error.message.toLowerCase()))
  }

  let elements: unknown[]
  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(100_000),
    })
    if (!response.ok) {
      console.error('overpass status', response.status)
      return json(req, { error: 'provider_busy' }, 503)
    }
    const data: unknown = JSON.parse(await boundedText(response, MAX_RESPONSE_BYTES))
    elements = isRecord(data) && Array.isArray(data.elements) ? data.elements : []
  } catch (error) {
    console.error('overpass failed', error instanceof Error ? error.message : 'unknown')
    return json(req, { error: 'provider_busy' }, 503)
  }

  const venues = new Map<string, OsmVenue>()
  for (const raw of elements) {
    const element = asElement(raw)
    const venue = element ? toVenue(element) : null
    if (venue && !venues.has(venue.ref)) venues.set(venue.ref, venue)
    if (venues.size >= MAX_VENUES) break
  }

  const result = await auth.db.rpc('admin_import_osm_venues', {
    p_city: city,
    p_items: [...venues.values()],
  })
  if (result.error) {
    console.error('import failed', result.error.message)
    return json(req, { error: 'import_failed' }, rpcStatus(result.error.message.toLowerCase()))
  }
  return json(req, { found: elements.length, ...(isRecord(result.data) ? result.data : {}) })
})
