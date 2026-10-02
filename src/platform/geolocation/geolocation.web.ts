import { err, ok } from '@/shared/lib/result'
import type { GeolocationService } from './geolocation'
import { queryPermission } from '../web-permissions'

export function createWebGeolocation(): GeolocationService {
  return {
    checkPermission: () => queryPermission('geolocation'),

    getCurrentPosition(options = {}) {
      if (!('geolocation' in navigator)) return Promise.resolve(err('unsupported'))
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          ({ coords }) =>
            resolve(
              ok({
                latitude: coords.latitude,
                longitude: coords.longitude,
                accuracy: coords.accuracy,
              }),
            ),
          (error) => {
            if (error.code === error.PERMISSION_DENIED) resolve(err('permission_denied'))
            else if (error.code === error.TIMEOUT) resolve(err('timeout'))
            else resolve(err('unavailable'))
          },
          {
            enableHighAccuracy: options.highAccuracy ?? true,
            timeout: options.timeoutMs ?? 10_000,
            // Never reuse a cached fix: the check-in radius (150 m) needs a fresh one.
            maximumAge: 0,
          },
        )
      })
    },
  }
}
