import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage'
import type { SecureStorageService } from './secure-storage'

/**
 * Keychain (iOS) / Keystore-encrypted storage (Android) for the Supabase session.
 * Items stay on this device only (no iCloud/backup migration) and are readable after
 * the first unlock, so a session refresh in the background does not fail.
 */
export function createNativeSecureStorage(prefix = 'nl.secure.'): SecureStorageService {
  const ready = (async () => {
    await SecureStorage.setKeyPrefix(prefix)
    await SecureStorage.setSynchronize(false)
    await SecureStorage.setDefaultKeychainAccess(KeychainAccess.afterFirstUnlockThisDeviceOnly)
  })().catch(() => undefined)

  // Fail soft like the web adapter: a storage error must never crash the app.
  const run = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    await ready
    try {
      return await fn()
    } catch {
      return fallback
    }
  }
  return {
    getItem: (key) => run(() => SecureStorage.getItem(key), null),
    setItem: (key, value) => run(() => SecureStorage.setItem(key, value), undefined),
    removeItem: (key) => run(() => SecureStorage.removeItem(key), undefined),
  }
}
