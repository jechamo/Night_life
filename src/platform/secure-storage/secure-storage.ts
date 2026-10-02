/**
 * Port for secrets that must survive restarts (the Supabase session).
 * Web: localStorage (the browser offers nothing stronger to a SPA).
 * Native (Annex B): Keychain / Android Keystore via an official Capacitor plugin.
 */
export interface SecureStorageService {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}
