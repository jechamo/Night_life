import { parseOpeningHours } from '@/features/places/model/cities'
import {
  VIBES,
  type EventOrigin,
  type EventStatus,
  type Place,
  type PlaceEvent,
  type PlaceStats,
  type Vibe,
} from '@/features/places/model/types'
import type {
  CreateEventError,
  LostFoundError,
  LostFoundPost,
  PlacesService,
} from '@/features/places/services/places-service'
import { ACCENT_KEYS, type AccentKey } from '@/shared/domain/venue-types'
import { err, ok } from '@/shared/lib/result'
import type { Db } from './client'
import { asText, errorMessage } from './errors'

type Row = Record<string, unknown>

const isRecord = (value: unknown): value is Row =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const rows = (value: unknown): Row[] => (Array.isArray(value) ? value.filter(isRecord) : [])

const hint = (error: unknown) => errorMessage(error).toLowerCase()

function fail(error: unknown): never {
  throw error instanceof Error ? error : new Error(errorMessage(error) || 'db_error')
}

const numberOrNull = (value: unknown): number | null =>
  value === null || value === undefined || Number.isNaN(Number(value)) ? null : Number(value)

/** Server payloads are already thresholded (PRD 4.3); the UI applies it again. */
export function asStats(row: Row): PlaceStats {
  const ratio = isRecord(row.ratio)
    ? {
        women: Number(row.ratio.women ?? 0),
        men: Number(row.ratio.men ?? 0),
        other: Number(row.ratio.other ?? 0),
      }
    : null
  return {
    people: Number(row.people ?? 0),
    averageAge: numberOrNull(row.averageAge),
    greenPercent: numberOrNull(row.greenPercent),
    ratio,
    goingTonight: Number(row.goingTonight ?? 0),
  }
}

function asVibes(raw: unknown): Record<Vibe, number> {
  const base: Record<Vibe, number> = { fire: 0, music: 0, chill: 0, packed: 0, friendly: 0 }
  if (!isRecord(raw)) return base
  for (const vibe of VIBES) base[vibe] = Number(raw[vibe] ?? 0)
  return base
}

const asAccent = (type: string): AccentKey =>
  (ACCENT_KEYS as readonly string[]).includes(type) ? (type as AccentKey) : 'bar'

const asPrice = (value: unknown): Place['price'] => {
  const n = Number(value)
  return n === 1 || n === 2 || n === 3 || n === 4 ? n : 2
}

const EVENT_STATUSES: readonly EventStatus[] = ['unconfirmed', 'confirmed', 'official']
const asEventStatus = (value: string): EventStatus =>
  (EVENT_STATUSES as readonly string[]).includes(value) ? (value as EventStatus) : 'hidden'

const asOrigin = (value: string): EventOrigin =>
  value === 'venue' || value === 'user' ? value : 'import'

export function venueToPlace(row: Row, description = ''): Place | null {
  const id = asText(row.id)
  const lat = numberOrNull(row.lat)
  const lng = numberOrNull(row.lng)
  // Expired Google coordinates come back as null: the venue cannot be placed (ADR 0010).
  if (!id || lat === null || lng === null) return null
  const minAge = numberOrNull(row.minAge)
  return {
    id,
    name: asText(row.name),
    type: asAccent(asText(row.type)),
    location: { lat, lng },
    address: asText(row.address),
    price: asPrice(row.price),
    hours: asText(row.hours),
    openNow: Boolean(row.openNow),
    rating: numberOrNull(row.rating),
    sponsored: false,
    stats: asStats(row),
    vibes: asVibes(row.vibes),
    city: asText(row.city) || undefined,
    description: description || undefined,
    phone: asText(row.phone) || undefined,
    website: /^https:\/\//.test(asText(row.website)) ? asText(row.website) : undefined,
    openingHours: parseOpeningHours(row.openingHours),
    music: Array.isArray(row.music) ? row.music.map((m) => asText(m)).filter(Boolean) : undefined,
    dressCode: asText(row.dressCode) || undefined,
    minAge: minAge ?? undefined,
  }
}

export function eventToPlace(row: Row, stats?: PlaceStats): Place | null {
  const id = asText(row.id)
  const lat = numberOrNull(row.lat)
  const lng = numberOrNull(row.lng)
  if (!id || lat === null || lng === null) return null
  const startsAt = asText(row.startsAt)
  const endsAt = asText(row.endsAt)
  const event: PlaceEvent = {
    status: asEventStatus(asText(row.status)),
    origin: asOrigin(asText(row.origin)),
    startsAt,
    endsAt,
    createdAt: asText(row.createdAt, startsAt),
    confirmations: Number(row.confirmations ?? 0),
    fakeReports: Number(row.fakeReports ?? 0),
    description: asText(row.description),
  }
  const now = Date.now()
  return {
    id,
    name: asText(row.title),
    type: 'event',
    location: { lat, lng },
    address: [asText(row.placeName), asText(row.address)].filter(Boolean).join(' · '),
    price: 1,
    hours: '',
    openNow: Date.parse(startsAt) <= now && now < Date.parse(endsAt),
    rating: null,
    sponsored: false,
    stats: stats ?? asStats({}),
    vibes: asVibes(null),
    event,
  }
}

function asLostFound(raw: unknown): LostFoundPost[] {
  return rows(raw).map((item) => ({
    id: asText(item.id),
    placeId: asText(item.placeId),
    mine: Boolean(item.mine),
    text: asText(item.text),
    createdAt: asText(item.createdAt),
    replies: rows(item.replies).map((r) => ({
      id: asText(r.id),
      mine: Boolean(r.mine),
      text: asText(r.text),
      createdAt: asText(r.createdAt),
    })),
  }))
}

function lostFoundError(error: unknown): LostFoundError {
  const text = hint(error)
  if (text.includes('too_long')) return 'too_long'
  if (text.includes('empty')) return 'empty'
  if (text.includes('no_recent_check_in')) return 'no_recent_check_in'
  return fail(error)
}

function createEventError(error: unknown): CreateEventError {
  const text = hint(error)
  if (text.includes('not_public')) return 'not_public'
  if (text.includes('duplicate')) return 'duplicate'
  if (text.includes('daily_limit') || text.includes('rate limited')) return 'daily_limit'
  if (text.includes('age verification')) return 'not_verified'
  return fail(error)
}

/**
 * Venues and events over Supabase (Block 7): catalogue via `search_places` (stats
 * thresholded on the server), events via `list_events`, and every write through an
 * RPC that re-checks registration, age, 150 m, limits and `is_test` isolation.
 */
export function createPlacesService(db: Db): PlacesService {
  const load = async (): Promise<Place[]> => {
    const [venues, events] = await Promise.all([
      db.rpc('search_places', { p_limit: 200 }),
      db.rpc('list_events', {}),
    ])
    if (venues.error) fail(venues.error)
    if (events.error) fail(events.error)
    const venueRows = rows(venues.data)
    const eventRows = rows(events.data)
    const ids = venueRows.map((r) => asText(r.id)).filter(Boolean)
    const [descriptions, eventStats] = await Promise.all([
      ids.length
        ? db.from('venues').select('id, description').in('id', ids)
        : Promise.resolve({ data: [] as { id: string; description: string }[] }),
      Promise.all(eventRows.map((r) => db.rpc('get_place_stats', { p_place_id: asText(r.id) }))),
    ])
    const byId = new Map((descriptions.data ?? []).map((d) => [d.id, d.description]))
    const places: Place[] = []
    for (const row of venueRows) {
      const place = venueToPlace(row, byId.get(asText(row.id)) ?? '')
      if (place) places.push(place)
    }
    eventRows.forEach((row, i) => {
      const stats = eventStats[i]?.data
      const place = eventToPlace(row, isRecord(stats) ? asStats(stats) : undefined)
      if (place) places.push(place)
    })
    return places
  }

  const findPlace = async (id: string): Promise<Place> => {
    const place = (await load()).find((p) => p.id === id)
    if (!place) throw new Error('not_found')
    return place
  }

  return {
    list: load,

    async reserveMapLoad() {
      const { data, error } = await db.rpc('reserve_map_load')
      if (error || !isRecord(data)) return { granted: false, reason: 'unavailable' }
      if (data.granted === true && typeof data.token === 'string' && data.token.startsWith('pk.')) {
        return { granted: true, token: data.token }
      }
      return { granted: false, reason: data.reason === 'quota' ? 'quota' : 'no_token' }
    },

    async myVibe(placeId) {
      const { data, error } = await db.rpc('my_vibe', { p_place_id: placeId })
      if (error) fail(error)
      return (VIBES as readonly string[]).includes(data ?? '') ? (data as Vibe) : null
    },

    async voteVibe(placeId, vibe) {
      const { error } = await db.rpc('vote_vibe', { p_place_id: placeId, p_vibe: vibe })
      if (error) return hint(error).includes('no_check_in') ? err('no_check_in') : fail(error)
      return ok(await findPlace(placeId))
    },

    async confirmEvent(placeId) {
      const { error } = await db.rpc('confirm_event', { p_id: placeId })
      if (error) {
        const text = hint(error)
        if (text.includes('already_confirmed')) return err('already_confirmed')
        if (text.includes('not_unconfirmed')) return err('not_unconfirmed')
        return fail(error)
      }
      return ok(await findPlace(placeId))
    },

    async reportEvent(placeId, reason) {
      const { error } = await db.rpc('report_event', { p_id: placeId, p_reason: reason })
      if (error) fail(error)
    },

    async createEvent(input) {
      const { data, error } = await db.rpc('create_event', {
        p: {
          title: input.title,
          category: input.category,
          placeName: input.placeName,
          address: input.address,
          lat: input.location.lat,
          lng: input.location.lng,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          description: input.description,
          publicPlaceConfirmed: input.publicPlaceConfirmed,
        },
      })
      if (error) return err(createEventError(error))
      const place = isRecord(data) ? eventToPlace(data) : null
      return place ? ok(place) : fail(new Error('no_data'))
    },

    async lostAndFound(placeId) {
      const { data, error } = await db.rpc('lost_found_list', { p_place_id: placeId })
      if (error) fail(error)
      return asLostFound(data)
    },

    async postLostFound(placeId, text) {
      const { data, error } = await db.rpc('lost_found_post', { p_place_id: placeId, p_text: text })
      if (error) return err(lostFoundError(error))
      const [post] = asLostFound([data])
      return post ? ok(post) : fail(new Error('no_data'))
    },

    async replyLostFound(postId, text) {
      const { data, error } = await db.rpc('lost_found_reply', { p_post_id: postId, p_text: text })
      if (error) return err(lostFoundError(error))
      const post = asLostFound(data).find((p) => p.id === postId)
      return post ? ok(post) : fail(new Error('no_data'))
    },

    async editLostFound(postId, text) {
      const { data, error } = await db.rpc('lost_found_edit', { p_id: postId, p_text: text })
      if (error) return err(lostFoundError(error))
      const post = asLostFound(data).find((p) => p.id === postId)
      return post ? ok(post) : fail(new Error('no_data'))
    },

    async deleteLostFound(postId) {
      const { error } = await db.rpc('lost_found_delete', { p_id: postId })
      if (error) fail(error)
    },
  }
}
