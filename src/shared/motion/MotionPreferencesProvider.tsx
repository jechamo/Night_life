import { MotionConfig, useReducedMotion } from 'motion/react'
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePlatform } from '@/platform'
import { THEMES } from '@/shared/theme/themes'
import { useTheme } from '@/shared/theme/ThemeProvider'
import { PREFERENCE_KEYS } from '@/shared/config/preferences'
import { getMotionTokens, type MotionTokens } from './tokens'

interface MotionPreferences {
  tokens: MotionTokens
  /** "Reducir movimiento" app setting (PRD 5.3 Perfil → Ajustes). */
  reduceMotionSetting: boolean
  setReduceMotionSetting: (value: boolean) => void
  systemPrefersReduced: boolean
}

const MotionContext = createContext<MotionPreferences | null>(null)

export function MotionPreferencesProvider({
  initialReduceMotion,
  children,
}: {
  initialReduceMotion: boolean
  children: ReactNode
}) {
  const { preferences } = usePlatform()
  const { themeId } = useTheme()
  const systemPrefersReduced = useReducedMotion() ?? false
  const [reduceMotionSetting, setSetting] = useState(initialReduceMotion)

  const tokens = useMemo(
    () => getMotionTokens(THEMES[themeId].motion, systemPrefersReduced || reduceMotionSetting),
    [themeId, systemPrefersReduced, reduceMotionSetting],
  )

  // CSS animations (live pulse, shimmer, glitch) read this attribute.
  useEffect(() => {
    document.documentElement.dataset.motion = tokens.reduced ? 'reduced' : 'full'
  }, [tokens.reduced])

  const value = useMemo<MotionPreferences>(
    () => ({
      tokens,
      reduceMotionSetting,
      systemPrefersReduced,
      setReduceMotionSetting: (next) => {
        setSetting(next)
        void preferences.set(PREFERENCE_KEYS.reduceMotion, String(next))
      },
    }),
    [tokens, reduceMotionSetting, systemPrefersReduced, preferences],
  )

  return (
    <MotionContext value={value}>
      <MotionConfig
        reducedMotion={tokens.reduced ? 'always' : 'never'}
        transition={tokens.spring.snappy}
      >
        {children}
      </MotionConfig>
    </MotionContext>
  )
}

export function useMotionPreferences(): MotionPreferences {
  const value = use(MotionContext)
  if (!value)
    throw new Error('useMotionPreferences must be used inside <MotionPreferencesProvider>')
  return value
}

export const useMotionTokens = (): MotionTokens => useMotionPreferences().tokens
