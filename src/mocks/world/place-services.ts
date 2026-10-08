import {
  checkInBlock,
  checkInExpiry,
  goingTonightWindow,
  LOST_FOUND_CHECKIN_HOURS,
  LOST_FOUND_MAX_CHARS,
  LOST_FOUND_TTL_HOURS,
} from '@/features/attendance/model/attendance'
import type { AttendanceService } from '@/features/attendance/services/attendance-service'
import { canCreateEvent, evaluateEvent, isDuplicateEvent } from '@/features/events/model/events'
import { isEvent, type Place } from '@/features/places/model/types'
import type { LostFoundError, PlacesService } from '@/features/places/services/places-service'
import { err, ok, type Result } from '@/shared/lib/result'
import type { MockStore } from '../mock-store'
import type { MockConfig } from '../backoffice/config'
import { createMockShowcasePlaces } from '../backoffice/showcase'
import { createMockBookingPlaces } from '../backoffice/bookings'
import { emit, liveStatusOf, placeById, type WorldState } from './world-state'

type Wait = () => Promise<void>
const VISIBLE_EVENT = new Set(['unconfirmed', 'confirmed', 'official'])

export function createMockPlacesService(
  state: WorldState,
  store: MockStore,
  wait: Wait,
  config?: MockConfig,
): PlacesService {
  const refreshEvents = (now = new Date()) => {
    state.places = state.places.map((p) =>
      isEvent(p) ? { ...p, event: { ...p.event, status: evaluateEvent(p.event, now) } } : p,
    )
  }
  const update = (id: string, fn: (p: Place) => Place) => {
    state.places = state.places.map((p) => (p.id === id ? fn(p) : p))
    return state.places.find((p) => p.id === id)!
  }
  const textError = (text: string): LostFoundError | null =>
    text.trim().length === 0 ? 'empty' : text.length > LOST_FOUND_MAX_CHARS ? 'too_long' : null
  const recentlyHere = (placeId: string) => {
    const at = state.checkInsByPlace.get(placeId)
    return at !== undefined && Date.now() - at <= LOST_FOUND_CHECKIN_HOURS * 3_600_000
  }
  const findPost = (id: string) => state.lostFound.find((p) => p.id === id)

  return {
    ...createMockShowcasePlaces(config, state),
    ...createMockBookingPlaces(config, state, store),
    getById: (id) => Promise.resolve(placeById(state, id) ?? null),
    async list() {
      await wait()
      refreshEvents()
      return state.places.filter((p) => !isEvent(p) || VISIBLE_EVENT.has(p.event.status))
    },
    reserveMapLoad: () => Promise.resolve({ granted: false, reason: 'no_token' }),
    myVibe: (placeId) => Promise.resolve(state.myVibes.get(placeId) ?? null),
    async voteVibe(placeId, vibe) {
      await wait()
      if (state.attendance.checkIn?.placeId !== placeId) return err('no_check_in')
      const previous = state.myVibes.get(placeId)
      state.myVibes.set(placeId, vibe)
      return ok(
        update(placeId, (p) => {
          const vibes = { ...p.vibes, [vibe]: p.vibes[vibe] + 1 }
          if (previous) vibes[previous] = Math.max(0, vibes[previous] - 1)
          return { ...p, vibes }
        }),
      )
    },
    async liveStatus(placeId) {
      await wait()
      return liveStatusOf(state, placeId)
    },
    async reportLiveStatus(placeId, question, answer) {
      await wait()
      if (state.attendance.checkIn?.placeId !== placeId) return err('no_check_in')
      if (state.managedVenueIds.has(placeId)) return err('own_venue')
      state.myLive.set(placeId, { ...(state.myLive.get(placeId) ?? {}), [question]: answer })
      return ok(liveStatusOf(state, placeId))
    },
    async confirmEvent(placeId) {
      await wait()
      const place = placeById(state, placeId)
      if (!place || !isEvent(place) || place.event.status !== 'unconfirmed')
        return err('not_unconfirmed')
      if (state.confirmedByMe.has(placeId)) return err('already_confirmed')
      state.confirmedByMe.add(placeId)
      update(placeId, (p) =>
        isEvent(p) ? { ...p, event: { ...p.event, confirmations: p.event.confirmations + 1 } } : p,
      )
      refreshEvents()
      return ok(placeById(state, placeId)!)
    },
    async reportEvent(placeId, reason) {
      await wait()
      if (reason !== 'fake') return
      update(placeId, (p) =>
        isEvent(p) ? { ...p, event: { ...p.event, fakeReports: p.event.fakeReports + 1 } } : p,
      )
      refreshEvents()
    },
    async createEvent(input) {
      await wait()
      const verified = (await store.read()).verification.age.state === 'verified'
      const block = canCreateEvent(verified, state.eventsCreatedToday)
      if (block) return err(block)
      if (!input.publicPlaceConfirmed) return err('not_public')
      const existing = state.places.filter(isEvent).map((p) => ({
        title: p.name,
        location: p.location,
        startsAt: p.event.startsAt,
        endsAt: p.event.endsAt,
      }))
      if (
        isDuplicateEvent(
          {
            title: input.title,
            location: input.location,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
          },
          existing,
        )
      )
        return err('duplicate')
      state.eventsCreatedToday += 1
      const place: Place = {
        id: `e-${crypto.randomUUID()}`,
        name: input.title,
        type: 'event',
        location: input.location,
        address: `${input.placeName} · ${input.address}`,
        price: 1,
        hours: `${input.startsAt.slice(11, 16)}–${input.endsAt.slice(11, 16)}`,
        openNow: true,
        rating: null,
        sponsored: false,
        stats: { people: 0, averageAge: null, greenPercent: null, ratio: null, goingTonight: 0 },
        vibes: { fire: 0, music: 0, chill: 0, packed: 0, friendly: 0 },
        event: {
          status: 'unconfirmed',
          origin: 'user',
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          createdAt: new Date().toISOString(),
          confirmations: 0,
          fakeReports: 0,
          description: input.description,
        },
      }
      state.places.push(place)
      return ok(place)
    },
    async lostAndFound(placeId) {
      await wait()
      const cutoff = Date.now() - LOST_FOUND_TTL_HOURS * 3_600_000
      return state.lostFound.filter(
        (p) => p.placeId === placeId && Date.parse(p.createdAt) > cutoff,
      )
    },
    async postLostFound(
      placeId,
      text,
    ): Promise<Result<(typeof state.lostFound)[number], LostFoundError>> {
      await wait()
      if (!recentlyHere(placeId)) return err('no_recent_check_in')
      const problem = textError(text)
      if (problem) return err(problem)
      const post = {
        id: crypto.randomUUID(),
        placeId,
        mine: true,
        text: text.trim(),
        createdAt: new Date().toISOString(),
        replies: [],
      }
      state.lostFound.unshift(post)
      return ok(post)
    },
    async replyLostFound(postId, text) {
      await wait()
      const post = findPost(postId)
      if (!post || !recentlyHere(post.placeId)) return err('no_recent_check_in')
      const problem = textError(text)
      if (problem) return err(problem)
      const updated = {
        ...post,
        replies: [
          ...post.replies,
          {
            id: crypto.randomUUID(),
            mine: true,
            text: text.trim(),
            createdAt: new Date().toISOString(),
          },
        ],
      }
      state.lostFound = state.lostFound.map((p) => (p.id === postId ? updated : p))
      return ok(updated)
    },
    async editLostFound(postId, text) {
      await wait()
      const post = findPost(postId)
      if (!post?.mine) return err('no_recent_check_in')
      const problem = textError(text)
      if (problem) return err(problem)
      const updated = { ...post, text: text.trim() }
      state.lostFound = state.lostFound.map((p) => (p.id === postId ? updated : p))
      return ok(updated)
    },
    async deleteLostFound(postId) {
      await wait()
      state.lostFound = state.lostFound.filter((p) => !(p.id === postId && p.mine))
    },
  }
}

export function createMockAttendanceService(
  state: WorldState,
  wait: Wait,
  options: { ignoreTonightWindow: () => boolean },
): AttendanceService {
  const bump = (placeId: string | undefined, delta: number) => {
    const place = placeById(state, placeId)
    if (!place) return
    const stats = { ...place.stats, people: Math.max(0, place.stats.people + delta) }
    state.places = state.places.map((p) => (p.id === place.id ? { ...p, stats } : p))
    emit(state, { type: 'stats', placeId: place.id, stats })
  }
  return {
    getMine: () => Promise.resolve(state.attendance),
    async checkIn(placeId, position, { visible }) {
      await wait()
      const place = placeById(state, placeId)
      if (!place) return err('no_location')
      const block = checkInBlock(position, place.location)
      if (block) return err(block)
      // Only one active check-in: the previous one ends.
      if (state.attendance.checkIn) bump(state.attendance.checkIn.placeId, -1)
      const now = new Date()
      state.attendance = {
        ...state.attendance,
        checkIn: {
          placeId,
          since: now.toISOString(),
          expiresAt: checkInExpiry(now).toISOString(),
          visible,
        },
        lastCheckInAt: now.toISOString(),
      }
      state.checkInsByPlace.set(placeId, now.getTime())
      bump(placeId, 1)
      return ok(state.attendance)
    },
    async checkOut() {
      await wait()
      bump(state.attendance.checkIn?.placeId, -1)
      state.attendance = { ...state.attendance, checkIn: null }
      return state.attendance
    },
    async setGoing(placeId) {
      await wait()
      const slot = goingTonightWindow(new Date())
      if (!slot.open && !options.ignoreTonightWindow()) return err('outside_window')
      state.attendance = {
        ...state.attendance,
        going: { placeId, expiresAt: slot.expiresAt.toISOString() },
      }
      return ok(state.attendance)
    },
    async cancelGoing() {
      await wait()
      state.attendance = { ...state.attendance, going: null }
      return state.attendance
    },
  }
}
