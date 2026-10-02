import type { PreferencesService } from './preferences'

export function createWebPreferences(namespace = 'nl.pref.'): PreferencesService {
  const run = <T>(fn: () => T): T | null => {
    try {
      return fn()
    } catch {
      return null
    }
  }
  return {
    get: (key) => Promise.resolve(run(() => window.localStorage.getItem(namespace + key))),
    set: (key, value) => {
      run(() => window.localStorage.setItem(namespace + key, value))
      return Promise.resolve()
    },
    remove: (key) => {
      run(() => window.localStorage.removeItem(namespace + key))
      return Promise.resolve()
    },
  }
}
