import type { SecureStorageService } from './secure-storage'

export function createWebSecureStorage(namespace = 'nl.secure.'): SecureStorageService {
  return {
    getItem: (key) =>
      Promise.resolve(readSafely(() => window.localStorage.getItem(namespace + key))),
    setItem: (key, value) => {
      readSafely(() => window.localStorage.setItem(namespace + key, value))
      return Promise.resolve()
    },
    removeItem: (key) => {
      readSafely(() => window.localStorage.removeItem(namespace + key))
      return Promise.resolve()
    },
  }
}

/** Storage can throw (private mode, quota, disabled cookies): fail soft, never crash. */
function readSafely<T>(fn: () => T): T | null {
  try {
    return fn()
  } catch {
    return null
  }
}
