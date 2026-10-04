/**
 * Public surface of the platform layer (PRD 3.3). Import from `@/platform` only.
 * Web adapters are wired in `createWebPlatform`; native ones arrive with Annex B.
 */
export type { Platform } from './platform'
export type { AppUpdatesService, AppUpdateState } from './app-updates'
export type { PermissionStatus, PlatformRuntime } from './types'
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
