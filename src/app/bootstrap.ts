import type { Platform } from '@/platform'
import { PREFERENCE_KEYS } from '@/shared/config/preferences'
import { DEFAULT_THEME_ID, isThemeId, type ThemeId } from '@/shared/theme/themes'
import { DEFAULT_LANGUAGE, isLanguage, type Language } from '@/i18n'

export interface InitialSettings {
  themeId: ThemeId
  reduceMotion: boolean
  language: Language
}

/** Browser language as a first guess; only ES/EN are supported (PRD 3.4). */
function guessLanguage(): Language {
  return navigator.language.toLowerCase().startsWith('en') ? 'en' : DEFAULT_LANGUAGE
}

/**
 * Reads persisted preferences BEFORE the first render, so the right theme and
 * language paint immediately (async on purpose: native storage is async).
 */
export async function loadInitialSettings(platform: Platform): Promise<InitialSettings> {
  const [theme, reduceMotion, language] = await Promise.all([
    platform.preferences.get(PREFERENCE_KEYS.theme),
    platform.preferences.get(PREFERENCE_KEYS.reduceMotion),
    platform.preferences.get(PREFERENCE_KEYS.language),
  ])
  return {
    themeId: isThemeId(theme) ? theme : DEFAULT_THEME_ID,
    reduceMotion: reduceMotion === 'true',
    language: isLanguage(language) ? language : guessLanguage(),
  }
}
