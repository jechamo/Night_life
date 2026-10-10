import type { AppStateService } from './app-state'

export function createWebAppState(): AppStateService {
  return {
    onActiveChange(handler) {
      const listener = () => handler(document.visibilityState === 'visible')
      document.addEventListener('visibilitychange', listener)
      return () => document.removeEventListener('visibilitychange', listener)
    },
    // The browser owns its back button; the router already receives popstate.
    onBackButton: () => () => undefined,
    exit: () => undefined,
  }
}
