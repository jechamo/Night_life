import type { Result } from '@/shared/lib/result'
import type { LatLng } from '@/features/places/model/types'
import type { CheckInBlock } from '../model/attendance'

/** Only "place + time" is ever stored, never raw GPS (PRD 4.1, 6.3). */
export interface AttendanceState {
  checkIn: { placeId: string; since: string; expiresAt: string; visible: boolean } | null
  going: { placeId: string; expiresAt: string } | null
  lastCheckInAt: string | null
}

export interface AttendanceService {
  getMine(): Promise<AttendanceState>
  /** `position` is used for the 150 m check and then discarded. */
  checkIn(
    placeId: string,
    position: LatLng | null,
    options: { visible: boolean },
  ): Promise<Result<AttendanceState, Exclude<CheckInBlock, null>>>
  checkOut(): Promise<AttendanceState>
  setGoing(placeId: string): Promise<Result<AttendanceState, 'outside_window'>>
  cancelGoing(): Promise<AttendanceState>
}
