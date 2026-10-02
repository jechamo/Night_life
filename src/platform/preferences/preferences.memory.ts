import type { PreferencesService } from './preferences'

/** In-memory implementation for tests and for storage-less environments. */
export function createMemoryPreferences(initial: Record<string, string> = {}): PreferencesService {
  const store = new Map(Object.entries(initial))
  return {
    get: (key) => Promise.resolve(store.get(key) ?? null),
    set: (key, value) => {
      store.set(key, value)
      return Promise.resolve()
    },
    remove: (key) => {
      store.delete(key)
      return Promise.resolve()
    },
  }
}
