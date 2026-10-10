/**
 * Public surface of the platform layer (PRD 3.3). Import from `@/platform` only.
 * Web adapters are wired in `createWebPlatform`. Native ones live behind the separate
 * `@/platform/native` entry, loaded with a dynamic import only inside the Capacitor shell.
 */
export type { Platform } from './platform'
export type { AppUpdatesService, AppUpdateState } from './app-updates'
export type { AppStateService } from './app-state/app-state'
export type { PermissionStatus, PlatformRuntime } from './types'
export type { BiometricError } from './biometrics/biometrics'
export type { Coordinates, GeolocationError } from './geolocation/geolocation'
export type { CameraError, LiveCameraStream } from './camera/camera'
export type { ShareOutcome } from './share/share'
export type { ImageError } from './images/images'
export { ACCEPTED_IMAGE_TYPES } from './images/images'
export type { CheckoutGateway, PaymentError, PaymentProvider } from './payments/payment-provider'
export { createWebPlatform } from './create-web-platform'
export { detectRuntime } from './runtime'
export { PlatformProvider, usePlatform } from './PlatformProvider'
export { isAllowedExternalUrl } from './in-app-browser/allowlist'
export { toSupabaseAuthStorage } from './secure-storage/supabase-auth-storage'
export { createStripeWebProvider } from './payments/stripe-web-provider'
export { disabledPaymentProvider } from './payments/disabled-provider'
export { selectPaymentProvider } from './payments/select-payment-provider'
