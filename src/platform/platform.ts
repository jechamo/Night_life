import type { BiometricsService } from './biometrics/biometrics'
import type { AudioService } from './audio/audio'
import type { CameraService } from './camera/camera'
import type { DeepLinksService } from './deep-links/deep-links'
import type { DeviceIdService } from './device-id/device-id'
import type { FileDownloadService } from './file-download/file-download'
import type { GeolocationService } from './geolocation/geolocation'
import type { HapticsService } from './haptics/haptics'
import type { ImagesService } from './images/images'
import type { InAppBrowserService } from './in-app-browser/in-app-browser'
import type { NotificationsService } from './notifications/notifications'
import type { PreferencesService } from './preferences/preferences'
import type { SecureStorageService } from './secure-storage/secure-storage'
import type { ShareService } from './share/share'
import type { PlatformRuntime } from './types'
import type { AppUpdatesService } from './app-updates'
import type { AppStateService } from './app-state/app-state'

/**
 * Every device capability the app uses (PRD 3.3 point 1). Features receive this
 * object through `usePlatform()` and never touch browser/device APIs directly.
 * Payments are a strategy selected per flags (see payments/select-payment-provider).
 */
export interface Platform {
  runtime: PlatformRuntime
  appUpdates: AppUpdatesService
  appState: AppStateService
  audio: AudioService
  geolocation: GeolocationService
  camera: CameraService
  haptics: HapticsService
  secureStorage: SecureStorageService
  preferences: PreferencesService
  share: ShareService
  deviceId: DeviceIdService
  biometrics: BiometricsService
  notifications: NotificationsService
  deepLinks: DeepLinksService
  browser: InAppBrowserService
  files: FileDownloadService
  images: ImagesService
}
