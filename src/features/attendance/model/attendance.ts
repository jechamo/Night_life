import { distanceMeters } from '@/features/places/model/geo'
import type { LatLng } from '@/features/places/model/types'

/** PRD 6.3 */
export const GOING_FROM_HOUR = 18
export const GOING_EXPIRES_HOUR = 6
export const CHECK_IN_RADIUS_M = 150
export const CHECK_IN_DURATION_MIN = 120

/** "Esta Noche Voy" can be marked from 18:00 and expires at 06:00 (local time). */
export function goingTonightWindow(now: Date): { open: boolean; expiresAt: Date } {
  const hour = now.getHours()
  const open = hour >= GOING_FROM_HOUR || hour < GOING_EXPIRES_HOUR
  const expiresAt = new Date(now)
  expiresAt.setHours(GOING_EXPIRES_HOUR, 0, 0, 0)
  if (hour >= GOING_EXPIRES_HOUR) expiresAt.setDate(expiresAt.getDate() + 1)
  return { open, expiresAt }
}

export type CheckInBlock = 'no_location' | 'too_far' | null

/** Manual check-in on the web: closer than 150 m (PRD 6.3). Only "place + time" is stored. */
export function checkInBlock(user: LatLng | null, place: LatLng): CheckInBlock {
  if (!user) return 'no_location'
  return distanceMeters(user, place) <= CHECK_IN_RADIUS_M ? null : 'too_far'
}

export const checkInExpiry = (at: Date): Date =>
  new Date(at.getTime() + CHECK_IN_DURATION_MIN * 60_000)

/** Lost & found needs a check-in in the last 12 h; posts vanish after 48 h (PRD 6.8). */
export const LOST_FOUND_CHECKIN_HOURS = 12
export const LOST_FOUND_TTL_HOURS = 48
export const LOST_FOUND_MAX_CHARS = 280
