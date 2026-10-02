import type { SecureStorageService } from './secure-storage'

/**
 * Shape expected by `@supabase/supabase-js` for `auth.storage` (PRD 3.3 point 4).
 * Declared locally so the platform layer does not depend on the Supabase SDK;
 * Block 5 passes the result of `toSupabaseAuthStorage()` to `createClient`.
 */
export interface SupabaseAuthStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

/** Swappable session storage: web storage now, native secure storage later. */
export function toSupabaseAuthStorage(storage: SecureStorageService): SupabaseAuthStorage {
  return {
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => storage.setItem(key, value),
    removeItem: (key) => storage.removeItem(key),
  }
}
