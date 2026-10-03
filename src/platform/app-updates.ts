import { registerSW } from 'virtual:pwa-register'

/**
 * Registers the service worker and reloads the page as soon as a new version takes
 * control, so nobody keeps running an old cached bundle after a deploy (PRD 3.1).
 */
export function registerAppUpdates(): void {
  if (!('serviceWorker' in navigator)) return
  void registerSW({ immediate: true })
}
