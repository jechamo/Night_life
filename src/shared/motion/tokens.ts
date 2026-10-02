import type { Transition } from 'motion/react'
import type { MotionProfile } from '@/shared/theme/themes'

/** PRD 8.4: every duration lives between 150 and 400 ms. */
export const DURATION_BOUNDS = { min: 0.15, max: 0.4 } as const
export const EASE_OUT: [number, number, number, number] = [0.2, 0.8, 0.2, 1]

export type SpringName = 'snappy' | 'sheet' | 'gentle' | 'bouncy'

export interface MotionTokens {
  /** True when everything must degrade to fades (OS, app setting or Mono theme). */
  reduced: boolean
  /** Brief Cyberpunk glitch allowed. */
  glitch: boolean
  duration: { fast: number; base: number; slow: number }
  spring: Record<SpringName, Transition>
  fade: Transition
}

const BASE_DURATION = { fast: 0.15, base: 0.25, slow: 0.4 }

// `visualDuration` keeps springs inside the 150-400 ms budget while staying physical.
const BASE_SPRINGS: Record<SpringName, { visualDuration: number; bounce: number }> = {
  snappy: { visualDuration: 0.25, bounce: 0.15 },
  sheet: { visualDuration: 0.35, bounce: 0.12 },
  gentle: { visualDuration: 0.4, bounce: 0 },
  bouncy: { visualDuration: 0.3, bounce: 0.35 },
}

export const clampDuration = (seconds: number): number =>
  Math.min(DURATION_BOUNDS.max, Math.max(DURATION_BOUNDS.min, seconds))

/**
 * Motion tokens for a theme profile. `calm` (Velvet) slows down and removes most
 * bounce; `minimal` (Mono) and reduced motion replace every spring with a fade.
 */
export function getMotionTokens(
  profile: MotionProfile,
  userOrSystemReduced: boolean,
): MotionTokens {
  const reduced = userOrSystemReduced || profile === 'minimal'
  const factor = profile === 'calm' ? 1.3 : 1
  const duration = {
    fast: clampDuration(BASE_DURATION.fast * factor),
    base: clampDuration(BASE_DURATION.base * factor),
    slow: clampDuration(BASE_DURATION.slow * factor),
  }
  const fade: Transition = {
    type: 'tween',
    ease: EASE_OUT,
    duration: reduced ? duration.fast : duration.base,
  }

  const spring = Object.fromEntries(
    (Object.keys(BASE_SPRINGS) as SpringName[]).map((name) => {
      if (reduced) return [name, fade]
      const base = BASE_SPRINGS[name]
      return [
        name,
        {
          type: 'spring',
          visualDuration: clampDuration(base.visualDuration * factor),
          bounce: profile === 'calm' ? base.bounce * 0.4 : base.bounce,
        } satisfies Transition,
      ]
    }),
  ) as Record<SpringName, Transition>

  return { reduced, glitch: !reduced && profile === 'expressive', duration, spring, fade }
}
