import type { PermissionState } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { err, ok } from '@/shared/lib/result'
import { isPermissionDenial, nativeErrorText } from '../native-errors'
import type { PermissionStatus } from '../types'
import type { GeolocationService } from './geolocation'

const toStatus = (state: PermissionState): PermissionStatus =>
  state === 'prompt-with-rationale' ? 'prompt' : state

/** Foreground, user-initiated reads only (background check-in is not enabled). */
export function createNativeGeolocation(): GeolocationService {
  const checkPermission = async (): Promise<PermissionStatus> => {
    try {
      return toStatus((await Geolocation.checkPermissions()).location)
    } catch {
      // Thrown when location services are switched off for the whole device.
      return 'unsupported'
    }
  }
  return {
    checkPermission,
    async getCurrentPosition(options = {}) {
      let status = await checkPermission()
      if (status === 'unsupported') return err('unavailable')
      if (status === 'prompt') {
        try {
          status = toStatus((await Geolocation.requestPermissions()).location)
        } catch {
          return err('permission_denied')
        }
      }
      if (status !== 'granted') return err('permission_denied')
      try {
        const { coords } = await Geolocation.getCurrentPosition({
          enableHighAccuracy: options.highAccuracy ?? true,
          timeout: options.timeoutMs ?? 10_000,
          // Never reuse a cached fix: the check-in radius (150 m) needs a fresh one.
          maximumAge: 0,
        })
        return ok({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        })
      } catch (error) {
        if (isPermissionDenial(error)) return err('permission_denied')
        return err(/timeout|timed out/.test(nativeErrorText(error)) ? 'timeout' : 'unavailable')
      }
    },
  }
}
