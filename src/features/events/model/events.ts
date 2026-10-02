import { distanceMeters } from '@/features/places/model/geo'
import type { EventStatus, LatLng } from '@/features/places/model/types'

/** PRD 6.7 */
export const CONFIRMATIONS_NEEDED = 3
export const CONFIRM_WINDOW_HOURS = 24
export const MAX_USER_EVENTS_PER_DAY = 2
export const FAKE_REPORTS_TO_HIDE = 3
const DUPLICATE_RADIUS_M = 100

export interface EventLifecycleInput {
  status: EventStatus
  createdAt: string
  endsAt: string
  confirmations: number
  fakeReports: number
}

/**
 * Event life cycle. Unconfirmed events need 3 distinct confirmations within 24 h or
 * they are deleted; 3 "fake" reports hide them for review; finished ones are archived.
 * The server runs the same rules (pg_cron in Block 7/9).
 */
export function evaluateEvent(event: EventLifecycleInput, now: Date): EventStatus {
  if (event.status === 'deleted' || event.status === 'archived') return event.status
  if (event.fakeReports >= FAKE_REPORTS_TO_HIDE) return 'hidden'
  if (event.status === 'hidden') return 'hidden'
  if (Date.parse(event.endsAt) <= now.getTime()) return 'archived'
  if (event.status === 'unconfirmed') {
    if (event.confirmations >= CONFIRMATIONS_NEEDED) return 'confirmed'
    const deadline = Date.parse(event.createdAt) + CONFIRM_WINDOW_HOURS * 3_600_000
    if (now.getTime() >= deadline) return 'deleted'
  }
  return event.status
}

export type CreateEventBlock = 'not_verified' | 'daily_limit' | null

export function canCreateEvent(ageVerified: boolean, createdToday: number): CreateEventBlock {
  if (!ageVerified) return 'not_verified'
  if (createdToday >= MAX_USER_EVENTS_PER_DAY) return 'daily_limit'
  return null
}

interface EventLike {
  title: string
  location: LatLng
  startsAt: string
  endsAt: string
}

const words = (s: string) =>
  new Set(
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2),
  )

/** Anti-duplicates: same spot (≤100 m), overlapping time and a similar title. */
export function isDuplicateEvent(candidate: EventLike, existing: readonly EventLike[]): boolean {
  const mine = words(candidate.title)
  return existing.some((other) => {
    const near = distanceMeters(candidate.location, other.location) <= DUPLICATE_RADIUS_M
    const overlap =
      Date.parse(candidate.startsAt) < Date.parse(other.endsAt) &&
      Date.parse(other.startsAt) < Date.parse(candidate.endsAt)
    const shared = [...words(other.title)].filter((w) => mine.has(w)).length
    return near && overlap && shared >= 1
  })
}
