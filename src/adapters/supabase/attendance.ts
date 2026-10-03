import type {
  AttendanceService,
  AttendanceState,
} from '@/features/attendance/services/attendance-service'
import { err, ok } from '@/shared/lib/result'
import type { Db } from './client'
import { asText, errorMessage } from './errors'

type Row = Record<string, unknown>

const isRecord = (value: unknown): value is Row =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

function fail(error: unknown): never {
  throw error instanceof Error ? error : new Error(errorMessage(error) || 'db_error')
}

export function asAttendance(raw: unknown): AttendanceState {
  const row = isRecord(raw) ? raw : {}
  const checkIn = isRecord(row.checkIn) ? row.checkIn : null
  const going = isRecord(row.going) ? row.going : null
  return {
    checkIn:
      checkIn && asText(checkIn.placeId)
        ? {
            placeId: asText(checkIn.placeId),
            since: asText(checkIn.since),
            expiresAt: asText(checkIn.expiresAt),
            visible: Boolean(checkIn.visible),
          }
        : null,
    going:
      going && asText(going.placeId)
        ? { placeId: asText(going.placeId), expiresAt: asText(going.expiresAt) }
        : null,
    lastCheckInAt: asText(row.lastCheckInAt) || null,
  }
}

/**
 * Check-in / "Esta Noche Voy" over Supabase (PRD 6.3). The position is only sent
 * for the 150 m check in `check_in` and is never stored: attendance keeps place + time.
 */
export function createAttendanceService(db: Db): AttendanceService {
  return {
    async getMine() {
      const { data, error } = await db.rpc('my_attendance')
      if (error) fail(error)
      return asAttendance(data)
    },

    async checkIn(placeId, position, options) {
      if (!position) return err('no_location')
      const { data, error } = await db.rpc('check_in', {
        p_place_id: placeId,
        p_lat: position.lat,
        p_lng: position.lng,
        p_visible: options.visible,
      })
      if (error) {
        const text = errorMessage(error).toLowerCase()
        if (text.includes('too_far')) return err('too_far')
        if (text.includes('no_location')) return err('no_location')
        return fail(error)
      }
      return ok(asAttendance(data))
    },

    async checkOut() {
      const { data, error } = await db.rpc('check_out')
      if (error) fail(error)
      return asAttendance(data)
    },

    async setGoing(placeId) {
      const { data, error } = await db.rpc('set_going', { p_place_id: placeId })
      if (error) {
        return errorMessage(error).includes('outside_window') ? err('outside_window') : fail(error)
      }
      return ok(asAttendance(data))
    },

    async cancelGoing() {
      const { data, error } = await db.rpc('cancel_going')
      if (error) fail(error)
      return asAttendance(data)
    },
  }
}
