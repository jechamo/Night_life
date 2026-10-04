/** Public state contains no session or application data. */
export interface AppUpdateState {
  online: boolean
  updateAvailable: boolean
}

/** Web/PWA updates; native builds provide their own adapter without a service worker. */
export interface AppUpdatesService {
  getSnapshot: () => AppUpdateState
  subscribe: (listener: () => void) => () => void
  start(): void
  stop(): void
  /** Reload only after the user has chosen to apply an available version. */
  applyUpdate(): void
}
