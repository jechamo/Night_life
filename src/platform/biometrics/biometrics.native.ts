import { BiometricAuth, BiometryErrorType } from '@aparajita/capacitor-biometric-auth'
import { err, ok } from '@/shared/lib/result'
import { nativeErrorText } from '../native-errors'
import type { BiometricError, BiometricsService } from './biometrics'

const CANCELLED = new Set<string>([
  BiometryErrorType.userCancel,
  BiometryErrorType.appCancel,
  BiometryErrorType.systemCancel,
  BiometryErrorType.userFallback,
])
const UNAVAILABLE = new Set<string>([
  BiometryErrorType.biometryNotAvailable,
  BiometryErrorType.biometryNotEnrolled,
  BiometryErrorType.passcodeNotSet,
  BiometryErrorType.noDeviceCredential,
])

function toError(error: unknown): BiometricError {
  const code = (error as { code?: unknown } | null)?.code
  if (typeof code === 'string' && CANCELLED.has(code)) return 'cancelled'
  if (typeof code === 'string' && UNAVAILABLE.has(code)) return 'unavailable'
  return /cancel/.test(nativeErrorText(error)) ? 'cancelled' : 'failed'
}

/**
 * Face ID / Touch ID / Android BiometricPrompt. A local unlock gate only: it never
 * grants roles, entitlements or a session (those stay on the server).
 */
export function createNativeBiometrics(): BiometricsService {
  return {
    async isAvailable() {
      try {
        // The device PIN/passcode is an accepted fallback, so it also counts.
        const { isAvailable, deviceIsSecure } = await BiometricAuth.checkBiometry()
        return isAvailable || deviceIsSecure
      } catch {
        return false
      }
    },
    async authenticate(reason) {
      try {
        await BiometricAuth.authenticate({
          reason,
          androidTitle: reason,
          // The device PIN is an accepted fallback; the app never sees either factor.
          allowDeviceCredential: true,
          androidConfirmationRequired: false,
        })
        return ok(undefined)
      } catch (error) {
        return err(toError(error))
      }
    },
  }
}
