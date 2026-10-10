import { createWebBiometrics } from './biometrics/biometrics.web'
import { createWebAudio } from './audio/audio.web'
import { createWebCamera } from './camera/camera.web'
import { createWebDeepLinks } from './deep-links/deep-links.web'
import { createInstallDeviceId } from './device-id/install-device-id'
import { createWebFileDownload } from './file-download/file-download.web'
import { createWebGeolocation } from './geolocation/geolocation.web'
import { createWebHaptics } from './haptics/haptics.web'
import { createWebImages } from './images/images.web'
import { createWebInAppBrowser } from './in-app-browser/in-app-browser.web'
import { createWebNotifications } from './notifications/notifications.web'
import type { Platform } from './platform'
import { createWebPreferences } from './preferences/preferences.web'
import { createWebSecureStorage } from './secure-storage/secure-storage.web'
import { createWebShare } from './share/share.web'
import { createWebAppUpdates } from './app-updates.web'
import { createWebAppState } from './app-state/app-state.web'

export interface WebPlatformOptions {
  /** Public origin used for return URLs; defaults to the current origin. */
  appUrl?: string
}

/** Adapter set for the browser/PWA. The Capacitor shell uses `createNativePlatform()`. */
export function createWebPlatform({ appUrl }: WebPlatformOptions = {}): Platform {
  const preferences = createWebPreferences()
  return {
    runtime: 'web',
    appUpdates: createWebAppUpdates(),
    appState: createWebAppState(),
    audio: createWebAudio(),
    geolocation: createWebGeolocation(),
    camera: createWebCamera(),
    haptics: createWebHaptics(),
    secureStorage: createWebSecureStorage(),
    preferences,
    share: createWebShare(),
    deviceId: createInstallDeviceId(preferences),
    biometrics: createWebBiometrics(),
    notifications: createWebNotifications(),
    deepLinks: createWebDeepLinks(appUrl || window.location.origin),
    browser: createWebInAppBrowser(),
    files: createWebFileDownload(),
    images: createWebImages(),
  }
}
