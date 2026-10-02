/**
 * Port for small, NON-sensitive preferences (theme, language, reduce motion,
 * install id). Mirrors @capacitor/preferences so the native swap is trivial.
 */
export interface PreferencesService {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}
