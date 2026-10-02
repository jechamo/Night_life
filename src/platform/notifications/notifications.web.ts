import type { PermissionStatus } from '../types'
import type { NotificationsService } from './notifications'

const fromBrowser = (value: NotificationPermission): PermissionStatus =>
  value === 'default' ? 'prompt' : value

export function createWebNotifications(): NotificationsService {
  const supported = typeof window !== 'undefined' && 'Notification' in window
  return {
    getPermission: () =>
      Promise.resolve(supported ? fromBrowser(window.Notification.permission) : 'unsupported'),
    async requestPermission() {
      if (!supported) return 'unsupported'
      return fromBrowser(await window.Notification.requestPermission())
    },
  }
}
