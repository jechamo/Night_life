import {
  type BookingSettings,
  type GuestEntry,
  type Reservation,
  type VenueGuestlist,
  BOOKING_MAX_DAYS_AHEAD,
  BOOKING_MIN_MINUTES_AHEAD,
  GUESTLIST_MAX_HOURS,
  MAX_ACTIVE_RESERVATIONS,
  isActiveReservation,
  normalizeGuestCode,
} from '@/features/bookings/model/bookings'
import type { PlacesService } from '@/features/places/services/places-service'
import type { VenuePanelService } from '@/features/venue-panel/services/venue-panel-service'
import { err, ok } from '@/shared/lib/result'
import type { MockStore } from '../mock-store'
import type { WorldState } from '../world/world-state'
import type { MockConfig } from './config'
import { ME } from './partners'

/** Simulated R5 back-office shared by the places and venue panel mocks. */
interface MockGuestlist {
  id: string
  venueId: string
  night: string
  title: string
  validUntil: string
  capacity: number
  status: 'open' | 'closed'
}
interface MockEntry {
  id: string
  listId: string
  userId: string
  name: string
  status: GuestEntry['status']
  code: string
  checkedInAt: string | null
}
export interface MockBookingsState {
  settings: Record<string, BookingSettings>
  reservations: (Reservation & { userId: string; name: string })[]
  lists: MockGuestlist[]
  entries: MockEntry[]
}

/**
 * Demo data of the simulated backend (never real people): Sala Aurora takes bookings and has
 * tonight's list open, so a person can try the whole flow; the venue's own demo guests have
 * fixed codes so the door can be tried too.
 */
export const DEMO_VENUE = 'v-aurora'
export const DEMO_GUEST_CODES: Record<string, string> = { Lucía: 'A1B2C3D4E5', Marco: '0F1E2D3C4B' }

export function createMockBookingsState(): MockBookingsState {
  return {
    settings: { [DEMO_VENUE]: { reservations: true, guestlists: true, maxParty: 8 } },
    reservations: [],
    lists: [
      {
        id: 'gl-demo-aurora',
        venueId: DEMO_VENUE,
        night: tonight(),
        title: 'Entrada gratis antes de la 1:30',
        validUntil: new Date(Date.now() + 4 * 3_600_000).toISOString(),
        capacity: 100,
        status: 'open',
      },
    ],
    entries: [],
  }
}

type Wait = () => Promise<void>

const tonight = () => new Date(Date.now() - 6 * 3_600_000).toISOString().slice(0, 10)
const randomCode = () =>
  Array.from({ length: 10 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('')
const DEFAULT_SETTINGS: BookingSettings = { reservations: false, guestlists: false, maxParty: 10 }

function requireBookings(config: MockConfig) {
  if (config.flags.venue_bookings_enabled !== 'on') throw new Error('disabled')
}

const managesVenue = (config: MockConfig, venueId: string) =>
  (config.partners.managers[venueId] ?? []).some((m) => m.userId === ME)

const placeName = (world: WorldState, venueId: string) =>
  world.places.find((p) => p.id === venueId)?.name ?? venueId

function entryJson(state: MockBookingsState, world: WorldState, e: MockEntry): GuestEntry {
  const list = state.lists.find((l) => l.id === e.listId)!
  return {
    id: e.id,
    listId: list.id,
    placeId: list.venueId,
    placeName: placeName(world, list.venueId),
    title: list.title,
    validUntil: list.validUntil,
    night: list.night,
    status: e.status,
    code: e.status === 'confirmed' ? e.code : null,
  }
}

const reservationView = ({ userId: _u, name: _n, ...r }: MockBookingsState['reservations'][0]) => ({
  ...r,
  status:
    r.status === 'requested' && Date.parse(r.arriveAt) < Date.now()
      ? ('expired' as const)
      : r.status,
})

const openList = (state: MockBookingsState, venueId: string) =>
  state.lists.find(
    (l) =>
      l.venueId === venueId &&
      l.night === tonight() &&
      l.status === 'open' &&
      Date.parse(l.validUntil) > Date.now(),
  )

const taken = (state: MockBookingsState, listId: string) =>
  state.entries.filter((e) => e.listId === listId && e.status !== 'cancelled').length

export function createMockBookingPlaces(
  config: MockConfig | undefined,
  world: WorldState,
  store: MockStore,
): Pick<
  PlacesService,
  | 'bookingOptions'
  | 'requestReservation'
  | 'cancelReservation'
  | 'joinGuestlist'
  | 'leaveGuestlist'
  | 'myBookings'
> {
  const on = () => {
    if (!config) throw new Error('disabled')
    requireBookings(config)
    return config
  }
  const ageVerified = async () => (await store.read()).verification.age.state === 'verified'
  return {
    async bookingOptions(placeId) {
      const c = on()
      const state = c.bookings
      const settings = state.settings[placeId] ?? DEFAULT_SETTINGS
      const list = settings.guestlists ? openList(state, placeId) : undefined
      const mine = list && state.entries.find((e) => e.listId === list.id && e.userId === ME)
      return {
        reservations: settings.reservations,
        maxParty: settings.maxParty,
        ageVerified: await ageVerified(),
        ownVenue: managesVenue(c, placeId),
        guestlist: list
          ? {
              id: list.id,
              title: list.title,
              validUntil: list.validUntil,
              full: taken(state, list.id) >= list.capacity,
            }
          : null,
        myEntry: mine ? entryJson(state, world, mine) : null,
        myReservations: state.reservations
          .filter(
            (r) =>
              r.placeId === placeId &&
              r.userId === ME &&
              Date.parse(r.arriveAt) > Date.now() - 6 * 3_600_000,
          )
          .map(reservationView),
      }
    },
    async requestReservation(placeId, input) {
      const c = on()
      const state = c.bookings
      if (!(await ageVerified())) return err('age_required')
      const settings = state.settings[placeId]
      if (!settings?.reservations) return err('not_available')
      if (managesVenue(c, placeId)) return err('own_venue')
      const at = Date.parse(input.arriveAt)
      if (
        input.party < 1 ||
        input.party > settings.maxParty ||
        Number.isNaN(at) ||
        at < Date.now() + BOOKING_MIN_MINUTES_AHEAD * 60_000 ||
        at > Date.now() + BOOKING_MAX_DAYS_AHEAD * 86_400_000
      )
        return err('invalid')
      const mine = state.reservations.filter((r) => r.userId === ME && isActiveReservation(r))
      if (mine.length >= MAX_ACTIVE_RESERVATIONS) return err('booking_limit')
      const night = new Date(at - 6 * 3_600_000).toISOString().slice(0, 10)
      if (
        mine.some(
          (r) =>
            r.placeId === placeId &&
            new Date(Date.parse(r.arriveAt) - 6 * 3_600_000).toISOString().slice(0, 10) === night,
        )
      )
        return err('already_booked')
      const reservation = {
        id: `res-${crypto.randomUUID()}`,
        placeId,
        placeName: placeName(world, placeId),
        arriveAt: new Date(at).toISOString(),
        party: input.party,
        kind: input.kind,
        status: 'requested' as const,
        reason: null,
        userId: ME,
        name: 'Tú',
      }
      state.reservations.push(reservation)
      return ok(reservationView(reservation))
    },
    async cancelReservation(id) {
      await Promise.resolve()
      const c = on()
      const r = c.bookings.reservations.find((x) => x.id === id && x.userId === ME)
      if (!r || !isActiveReservation(r)) throw new Error('not found')
      r.status = 'cancelled'
      return reservationView(r)
    },
    async joinGuestlist(listId) {
      const c = on()
      const state = c.bookings
      if (!(await ageVerified())) return err('age_required')
      const list = state.lists.find((l) => l.id === listId)
      if (!list || list !== openList(state, list.venueId)) return err('not_available')
      if (managesVenue(c, list.venueId)) return err('own_venue')
      const existing = state.entries.find((e) => e.listId === listId && e.userId === ME)
      if (existing && existing.status !== 'cancelled') return ok(entryJson(state, world, existing))
      if (taken(state, listId) >= list.capacity) return err('list_full')
      if (existing) existing.status = 'confirmed'
      const entry = existing ?? {
        id: `ge-${crypto.randomUUID()}`,
        listId,
        userId: ME,
        name: 'Tú',
        status: 'confirmed' as const,
        code: randomCode(),
        checkedInAt: null,
      }
      if (!existing) state.entries.push(entry)
      return ok(entryJson(state, world, entry))
    },
    async leaveGuestlist(entryId) {
      await Promise.resolve()
      const c = on()
      const e = c.bookings.entries.find((x) => x.id === entryId && x.userId === ME)
      if (e?.status !== 'confirmed') throw new Error('not found')
      e.status = 'cancelled'
      return entryJson(c.bookings, world, e)
    },
    async myBookings() {
      await Promise.resolve()
      const c = on()
      const state = c.bookings
      return {
        reservations: state.reservations
          .filter((r) => r.userId === ME && Date.parse(r.arriveAt) > Date.now() - 12 * 3_600_000)
          .sort((a, b) => a.arriveAt.localeCompare(b.arriveAt))
          .map(reservationView),
        entries: state.entries
          .filter((e) => e.userId === ME)
          .map((e) => entryJson(state, world, e)),
      }
    },
  }
}

/** Simulated people so a venue can try the panel and the door on its own. */
const DEMO_GUESTS = ['Lucía', 'Marco']

export function createMockBookingPanel(
  config: MockConfig,
  world: WorldState,
  wait: Wait,
): Pick<
  VenuePanelService,
  | 'saveBookingSettings'
  | 'reservations'
  | 'decideReservation'
  | 'guestlist'
  | 'saveGuestlist'
  | 'closeGuestlist'
  | 'checkInGuest'
> {
  const state = config.bookings
  const requireManager = (placeId: string) => {
    requireBookings(config)
    if (!managesVenue(config, placeId)) throw new Error('forbidden')
  }
  const settingsOf = (placeId: string) => state.settings[placeId] ?? DEFAULT_SETTINGS
  const guestlistOf = (placeId: string): VenueGuestlist => {
    const list = state.lists.find((l) => l.venueId === placeId && l.night === tonight())
    return {
      settings: settingsOf(placeId),
      list: list
        ? {
            id: list.id,
            title: list.title,
            validUntil: list.validUntil,
            capacity: list.capacity,
            status: list.status,
            entries: state.entries
              .filter((e) => e.listId === list.id && e.status !== 'cancelled')
              .map((e) => ({
                id: e.id,
                name: e.name,
                status: e.status,
                checkedInAt: e.checkedInAt,
              })),
          }
        : null,
    }
  }
  return {
    async saveBookingSettings(placeId, settings) {
      await wait()
      requireManager(placeId)
      const first = !state.settings[placeId]?.reservations && settings.reservations
      state.settings[placeId] = { ...settings }
      if (first && !state.reservations.some((r) => r.placeId === placeId && r.userId !== ME))
        state.reservations.push({
          id: `res-${crypto.randomUUID()}`,
          placeId,
          placeName: placeName(world, placeId),
          arriveAt: new Date(Date.now() + 3 * 3_600_000).toISOString(),
          party: 4,
          kind: 'table',
          status: 'requested',
          reason: null,
          userId: 'demo-lucia',
          name: DEMO_GUESTS[0]!,
        })
      return { ...settings }
    },
    async reservations(placeId) {
      await wait()
      requireManager(placeId)
      return {
        settings: settingsOf(placeId),
        items: state.reservations
          .filter((r) => r.placeId === placeId && r.status !== 'cancelled')
          .sort((a, b) => a.arriveAt.localeCompare(b.arriveAt))
          .map((r) => {
            const { placeName: _p, ...view } = reservationView(r)
            return { ...view, name: r.name }
          }),
      }
    },
    async decideReservation(placeId, id, accept, reason) {
      await wait()
      requireManager(placeId)
      const r = state.reservations.find((x) => x.id === id && x.placeId === placeId)
      if (r?.status !== 'requested') throw new Error('not found')
      r.status = accept ? 'accepted' : 'rejected'
      r.reason = accept ? null : reason?.trim() || null
      return reservationView(r)
    },
    async guestlist(placeId) {
      await wait()
      requireManager(placeId)
      return guestlistOf(placeId)
    },
    async saveGuestlist(placeId, input) {
      await wait()
      requireManager(placeId)
      if (!settingsOf(placeId).guestlists) return err('not_available')
      const until = Date.parse(input.validUntil)
      if (
        input.title.trim().length < 3 ||
        until <= Date.now() ||
        until > Date.now() + GUESTLIST_MAX_HOURS * 3_600_000
      )
        throw new Error('invalid list')
      const existing = state.lists.find((l) => l.venueId === placeId && l.night === tonight())
      if (existing)
        Object.assign(existing, {
          title: input.title.trim(),
          validUntil: input.validUntil,
          capacity: Math.max(input.capacity, taken(state, existing.id)),
          status: 'open',
        })
      else {
        const list: MockGuestlist = {
          id: `gl-${crypto.randomUUID()}`,
          venueId: placeId,
          night: tonight(),
          title: input.title.trim(),
          validUntil: input.validUntil,
          capacity: input.capacity,
          status: 'open',
        }
        state.lists.push(list)
        DEMO_GUESTS.forEach((name) =>
          state.entries.push({
            id: `ge-${crypto.randomUUID()}`,
            listId: list.id,
            userId: `demo-${name}`,
            name,
            status: 'confirmed',
            code: DEMO_GUEST_CODES[name] ?? randomCode(),
            checkedInAt: null,
          }),
        )
      }
      return ok(guestlistOf(placeId))
    },
    async closeGuestlist(placeId) {
      await wait()
      requireManager(placeId)
      const list = state.lists.find((l) => l.venueId === placeId && l.night === tonight())
      if (list) list.status = 'closed'
      return guestlistOf(placeId)
    },
    async checkInGuest(placeId, raw) {
      await wait()
      requireManager(placeId)
      const code = normalizeGuestCode(raw)
      const listIds = new Set(
        state.lists.filter((l) => l.venueId === placeId && l.night === tonight()).map((l) => l.id),
      )
      const e = state.entries.find(
        (x) => listIds.has(x.listId) && x.code === code && x.status !== 'cancelled',
      )
      if (!e) return err('invalid_code')
      if (e.status === 'checked_in')
        return ok({ result: 'already_used', name: e.name, checkedInAt: e.checkedInAt })
      e.status = 'checked_in'
      e.checkedInAt = new Date().toISOString()
      return ok({ result: 'ok', name: e.name, checkedInAt: e.checkedInAt })
    },
  }
}
