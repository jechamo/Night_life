import type { AppUpdatesService, AppUpdateState } from './app-updates'

/**
 * Native builds have no service worker: the binary is updated by the stores. Only
 * the connection state is published, so `AppStatus` still shows the offline notice.
 */
export function createNativeAppUpdates(): AppUpdatesService {
  let state: AppUpdateState = { online: navigator.onLine, updateAvailable: false }
  const listeners = new Set<() => void>()
  const update = () => {
    state = { online: navigator.onLine, updateAvailable: false }
    listeners.forEach((listener) => listener())
  }
  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start() {
      window.addEventListener('online', update)
      window.addEventListener('offline', update)
      update()
    },
    stop() {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    },
    applyUpdate: () => undefined,
  }
}
