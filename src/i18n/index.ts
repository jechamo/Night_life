import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import es from './locales/es.json'

/** PRD 3.4: i18n from day 1, ES default + EN. No hard-coded copy in components. */
export const LANGUAGES = ['es', 'en'] as const
export type Language = (typeof LANGUAGES)[number]
export const DEFAULT_LANGUAGE: Language = 'es'

export const resources = {
  es: { translation: es },
  en: { translation: en },
} as const

export const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)

export async function initI18n(language: Language): Promise<typeof i18n> {
  await i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: LANGUAGES,
    // React already escapes output; never inject translated HTML (PRD 6.15 A05).
    interpolation: { escapeValue: false },
    returnNull: false,
  })
  document.documentElement.lang = language
  return i18n
}

export { i18n }
