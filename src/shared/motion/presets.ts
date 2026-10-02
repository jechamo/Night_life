import type { Variants } from 'motion/react'

/**
 * Reusable motion presets (PRD 8.4). They only use transform and opacity.
 * Under reduced motion `<MotionConfig reducedMotion="always">` drops the
 * transform part automatically, so every preset degrades to a fade.
 */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

export const riseIn: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1 },
}

/** "Sello" for verification badges (PRD 8.4 signature moment). */
export const stamp: Variants = {
  hidden: { opacity: 0, scale: 1.8, rotate: -14 },
  visible: { opacity: 1, scale: 1, rotate: 0 },
}

export const staggerChildren = (stagger = 0.04): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger } },
})

/** Pressure response for any tappable surface. */
export const PRESS_SCALE = 0.96
