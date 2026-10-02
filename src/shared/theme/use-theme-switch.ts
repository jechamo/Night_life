import { useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useMotionPreferences } from '@/shared/motion/MotionPreferencesProvider'
import { getMotionTokens } from '@/shared/motion/tokens'
import { playGlitch, runViewTransition } from '@/shared/motion/view-transition'
import { useTheme } from './ThemeProvider'
import { THEMES, type ThemeId } from './themes'

/** Instant, animated theme change (PRD 8.2): crossfade + optional Cyberpunk glitch. */
export function useThemeSwitch(): (next: ThemeId) => void {
  const { themeId, setTheme } = useTheme()
  const { reduceMotionSetting, systemPrefersReduced } = useMotionPreferences()

  return useCallback(
    (next: ThemeId) => {
      if (next === themeId) return
      const nextTokens = getMotionTokens(
        THEMES[next].motion,
        reduceMotionSetting || systemPrefersReduced,
      )
      void runViewTransition(() => flushSync(() => setTheme(next))).then(() => {
        if (nextTokens.glitch) playGlitch()
      })
    },
    [themeId, setTheme, reduceMotionSetting, systemPrefersReduced],
  )
}
