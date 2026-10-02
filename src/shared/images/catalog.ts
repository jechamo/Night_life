import connect640 from '@/assets/images/onboarding/onboarding-connect-640.webp'
import connect1080 from '@/assets/images/onboarding/onboarding-connect-1080.webp'
import safe640 from '@/assets/images/onboarding/onboarding-safe-640.webp'
import safe1080 from '@/assets/images/onboarding/onboarding-safe-1080.webp'
import location320 from '@/assets/images/illustrations/illu-location-320.webp'
import location640 from '@/assets/images/illustrations/illu-location-640.webp'
import otp320 from '@/assets/images/illustrations/illu-phone-otp-320.webp'
import otp640 from '@/assets/images/illustrations/illu-phone-otp-640.webp'
import verification320 from '@/assets/images/illustrations/illu-verification-320.webp'
import verification640 from '@/assets/images/illustrations/illu-verification-640.webp'
import type { ThemeId } from '@/shared/theme/themes'

export interface ImageAsset {
  src: string
  srcSet: string
  width: number
  height: number
}

const asset = (
  small: string,
  large: string,
  sw: number,
  lw: number,
  ratio: number,
): ImageAsset => ({
  src: large,
  srcSet: `${small} ${sw}w, ${large} ${lw}w`,
  width: lw,
  height: Math.round(lw * ratio),
})

/** Neutral greyscale scenes, tinted per theme at runtime (docs/design/IMAGE_PROMPTS.md). */
export const SCENES = {
  connect: asset(connect640, connect1080, 640, 1080, 1.25),
  safe: asset(safe640, safe1080, 640, 1080, 1.25),
} as const

/** White clay illustrations on pure black; shown with `mix-blend-mode: screen`. */
export const ILLUSTRATIONS = {
  location: asset(location320, location640, 320, 640, 1),
  phoneOtp: asset(otp320, otp640, 320, 640, 1),
  verification: asset(verification320, verification640, 320, 640, 1),
} as const
export type IllustrationName = keyof typeof ILLUSTRATIONS

/**
 * Per-theme signature images. Empty until they are generated; components fall back
 * to an animated "live city" composition drawn with CSS.
 */
export const THEME_SIGNATURES: Partial<Record<ThemeId, ImageAsset>> = {}
