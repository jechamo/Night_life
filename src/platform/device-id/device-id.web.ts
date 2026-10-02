import type { PreferencesService } from '../preferences/preferences'
import type { DeviceIdService } from './device-id'

const KEY = 'device_id'

export function createWebDeviceId(preferences: PreferencesService): DeviceIdService {
  let cached: Promise<string> | null = null
  return {
    getDeviceId() {
      cached ??= (async () => {
        const existing = await preferences.get(KEY)
        if (existing) return existing
        const id = crypto.randomUUID()
        await preferences.set(KEY, id)
        return id
      })()
      return cached
    },
  }
}
