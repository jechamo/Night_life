/** Permission states shared by every device capability (location, camera, notifications…). */
export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported'

/** Where the bundle is running. `native` = Capacitor shell (Annex B, not packaged in the MVP). */
export type PlatformRuntime = 'web' | 'native'
