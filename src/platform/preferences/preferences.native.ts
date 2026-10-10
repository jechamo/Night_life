import { Preferences } from '@capacitor/preferences'
import type { PreferencesService } from './preferences'

/** UserDefaults / SharedPreferences. Non-sensitive values only (see the port). */
export function createNativePreferences(group = 'nl.pref'): PreferencesService {
  const ready = Preferences.configure({ group }).catch(() => undefined)
  const run = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    await ready
    try {
      return await fn()
    } catch {
      return fallback
    }
  }
  return {
    get: (key) => run(async () => (await Preferences.get({ key })).value, null),
    set: (key, value) => run(() => Preferences.set({ key, value }), undefined),
    remove: (key) => run(() => Preferences.remove({ key }), undefined),
  }
}
