import type { Result } from '@/shared/lib/result'
import type { PermissionStatus } from '../types'

export interface Coordinates {
  latitude: number
  longitude: number
  /** Accuracy radius in metres. */
  accuracy: number
}

export type GeolocationError = 'permission_denied' | 'unavailable' | 'timeout' | 'unsupported'

export interface PositionOptions {
  highAccuracy?: boolean
  timeoutMs?: number
}

/**
 * Port for device location. Native (Annex B) adds background location for the
 * automatic check-in; the web only supports foreground, user-initiated reads.
 * Raw coordinates are used client-side only (PRD 4.1: attendance stores no raw GPS).
 */
export interface GeolocationService {
  checkPermission(): Promise<PermissionStatus>
  getCurrentPosition(options?: PositionOptions): Promise<Result<Coordinates, GeolocationError>>
}
