import {
  createContext,
  use,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { usePlatform } from '@/platform'
import { PREFERENCE_KEYS } from '@/shared/config/preferences'
import { THEMES, type ThemeDefinition, type ThemeId } from './themes'

interface ThemeContextValue {
  themeId: ThemeId
  theme: ThemeDefinition
  /** Applies instantly (no animation). Use `useThemeSwitch()` for the animated switch. */
  setTheme: (id: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/** Writes the theme to the DOM synchronously so View Transitions can snapshot it. */
function applyThemeToDocument(theme: ThemeDefinition) {
  const root = document.documentElement
  root.dataset.theme = theme.id
  root.style.colorScheme = theme.colorScheme
  // Status bar / PWA chrome colour follows the theme.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme.colors.background)
}

export function ThemeProvider({
  initialThemeId,
  children,
}: {
  initialThemeId: ThemeId
  children: ReactNode
}) {
  const { preferences } = usePlatform()
  const [themeId, setThemeId] = useState(initialThemeId)

  useLayoutEffect(() => applyThemeToDocument(THEMES[themeId]), [themeId])

  const setTheme = useCallback(
    (id: ThemeId) => {
      applyThemeToDocument(THEMES[id])
      setThemeId(id)
      void preferences.set(PREFERENCE_KEYS.theme, id)
    },
    [preferences],
  )

  const value = useMemo(() => ({ themeId, theme: THEMES[themeId], setTheme }), [themeId, setTheme])
  return <ThemeContext value={value}>{children}</ThemeContext>
}

export function useTheme(): ThemeContextValue {
  const value = use(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>')
  return value
}
