import type { PermissionStatus } from '../types'

/** Port for notification permission. Push delivery itself is V2 (PRD 6.1). */
export interface NotificationsService {
  getPermission(): Promise<PermissionStatus>
  requestPermission(): Promise<PermissionStatus>
}
