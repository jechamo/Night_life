import { createContext, use } from 'react'

export interface BiometricLockValue {
  /** The device offers biometrics (always `false` on the web). */
  available: boolean
  enabled: boolean
  /** Enabling asks for biometrics first, so nobody locks themselves out. */
  setEnabled: (next: boolean) => Promise<boolean>
  /** Forgets the setting on this device (after signing out). */
  reset: () => Promise<void>
}

const NOOP: BiometricLockValue = {
  available: false,
  enabled: false,
  setEnabled: () => Promise.resolve(false),
  reset: () => Promise.resolve(),
}

export const BiometricLockContext = createContext<BiometricLockValue>(NOOP)

export const useBiometricLock = () => use(BiometricLockContext)
