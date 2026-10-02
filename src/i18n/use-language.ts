import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '@/platform'
import { PREFERENCE_KEYS } from '@/shared/config/preferences'
import { DEFAULT_LANGUAGE, isLanguage, type Language } from './index'

export function useLanguage(): { language: Language; setLanguage: (lng: Language) => void } {
  const { i18n } = useTranslation()
  const { preferences } = usePlatform()
  const language = isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : DEFAULT_LANGUAGE

  const setLanguage = useCallback(
    (lng: Language) => {
      void i18n.changeLanguage(lng)
      document.documentElement.lang = lng
      void preferences.set(PREFERENCE_KEYS.language, lng)
    },
    [i18n, preferences],
  )
  return { language, setLanguage }
}
