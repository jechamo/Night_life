import type { AppUpdatesService, AppUpdateState } from './app-updates'

const CHECK_INTERVAL_MS = 5 * 60_000

/**
 * Workbox generates the worker; registration uses the browser API directly so
 * updateViaCache can exclude stale HTTP entries. A controller change announces an
 * update instead of discarding forms. Neither checking nor applying clears Auth.
 */
export function createWebAppUpdates({
  reload = () => window.location.reload(),
}: { reload?: () => void } = {}): AppUpdatesService {
  let state: AppUpdateState = { online: navigator.onLine, updateAvailable: false }
  const listeners = new Set<() => void>()
  let started = false
  let hadController = false
  let registration: ServiceWorkerRegistration | undefined
  let interval: ReturnType<typeof setInterval> | undefined
  let checking = false
  let applying = false

  const publish = (patch: Partial<AppUpdateState>) => {
    const next = { ...state, ...patch }
    if (next.online === state.online && next.updateAvailable === state.updateAvailable) return
    state = next
    listeners.forEach((listener) => listener())
  }
  const check = async () => {
    if (!started || !registration || !navigator.onLine || checking) return
    checking = true
    try {
      await registration.update()
    } catch {
      // A failed update must leave the current shell usable; never log URLs/tokens.
    } finally {
      checking = false
    }
  }
  const connectionChanged = () => {
    publish({ online: navigator.onLine })
    if (navigator.onLine) void check()
  }
  const foreground = () => {
    if (document.visibilityState === 'visible') void check()
  }
  const controllerChanged = () => {
    if (hadController) publish({ updateAvailable: true })
    hadController = navigator.serviceWorker.controller !== null
  }
  const chunkFailed = (event: Event) => {
    // Vite emits this when a previous deployment's lazy chunk is no longer present.
    // Keep the error boundary and offer an explicit update; never loop on reload.
    event.preventDefault()
    publish({ updateAvailable: true })
    void check()
  }

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start() {
      if (started) return
      started = true
      window.addEventListener('online', connectionChanged)
      window.addEventListener('offline', connectionChanged)
      window.addEventListener('focus', foreground)
      window.addEventListener('vite:preloadError', chunkFailed)
      document.addEventListener('visibilitychange', foreground)
      if (!('serviceWorker' in navigator)) return
      hadController = navigator.serviceWorker.controller !== null
      navigator.serviceWorker.addEventListener('controllerchange', controllerChanged)
      void navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((current) => {
          if (!started) return
          registration = current
          interval = setInterval(() => void check(), CHECK_INTERVAL_MS)
          void check()
        })
        .catch(() => {
          // Unsupported/blocked registration does not prevent using the online app.
        })
    },
    stop() {
      started = false
      if (interval) clearInterval(interval)
      interval = undefined
      registration = undefined
      window.removeEventListener('online', connectionChanged)
      window.removeEventListener('offline', connectionChanged)
      window.removeEventListener('focus', foreground)
      window.removeEventListener('vite:preloadError', chunkFailed)
      document.removeEventListener('visibilitychange', foreground)
      if ('serviceWorker' in navigator)
        navigator.serviceWorker.removeEventListener('controllerchange', controllerChanged)
    },
    applyUpdate() {
      if (!state.updateAvailable || !state.online || applying) return
      applying = true
      reload()
    },
  }
}
