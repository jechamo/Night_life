import type { PermissionState } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { PermissionStatus } from '../types'
import type { NotificationsService } from './notifications'

const toStatus = (state: PermissionState): PermissionStatus =>
  state === 'prompt-with-rationale' ? 'prompt' : state

/**
 * Permission only. Remote push (APNs/FCM) needs store accounts and a provider, so it
 * stays in Block 12; the local-notifications plugin asks without registering a token.
 */
export function createNativeNotifications(): NotificationsService {
  return {
    async getPermission() {
      try {
        return toStatus((await LocalNotifications.checkPermissions()).display)
      } catch {
        return 'unsupported'
      }
    },
    async requestPermission() {
      try {
        return toStatus((await LocalNotifications.requestPermissions()).display)
      } catch {
        return 'unsupported'
      }
    },
  }
}
