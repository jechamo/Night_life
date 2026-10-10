import { createNativeAppState } from './app-state/app-state.native'
import { createNativeAppUpdates } from './app-updates.native'
import { createWebAudio } from './audio/audio.web'
import { createNativeBiometrics } from './biometrics/biometrics.native'
import { createNativeCamera } from './camera/camera.native'
import { createNativeDeepLinks } from './deep-links/deep-links.native'
import { createInstallDeviceId } from './device-id/install-device-id'
import { createNativeFileDownload } from './file-download/file-download.native'
import { createNativeGeolocation } from './geolocation/geolocation.native'
import { createNativeHaptics } from './haptics/haptics.native'
import { createWebImages } from './images/images.web'
import { createNativeInAppBrowser } from './in-app-browser/in-app-browser.native'
import { createNativeNotifications } from './notifications/notifications.native'
import type { Platform } from './platform'
import { createNativePreferences } from './preferences/preferences.native'
import { createNativeSecureStorage } from './secure-storage/secure-storage.native'
import { createNativeShare } from './share/share.native'

export interface NativePlatformOptions {
  /** Public HTTPS origin for provider return URLs and App/Universal Links. */
  appUrl: string
}

/**
 * Adapter set for the Capacitor shell (Annex B, Block 11). Audio and image
 * re-encoding run inside the WebView exactly as on the web, so they are shared.
 */
export function createNativePlatform({ appUrl }: NativePlatformOptions): Platform {
  const preferences = createNativePreferences()
  return {
    runtime: 'native',
    appUpdates: createNativeAppUpdates(),
    appState: createNativeAppState(),
    audio: createWebAudio(),
    geolocation: createNativeGeolocation(),
    camera: createNativeCamera(),
    haptics: createNativeHaptics(),
    secureStorage: createNativeSecureStorage(),
    preferences,
    share: createNativeShare(),
    deviceId: createInstallDeviceId(preferences),
    biometrics: createNativeBiometrics(),
    notifications: createNativeNotifications(),
    deepLinks: createNativeDeepLinks(appUrl),
    browser: createNativeInAppBrowser(),
    files: createNativeFileDownload(),
    images: createWebImages(),
  }
}
