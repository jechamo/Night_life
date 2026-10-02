import { err } from '@/shared/lib/result'
import type { BiometricsService } from './biometrics'

/** The web MVP has no biometric unlock; callers fall back to OTP re-auth. */
export function createWebBiometrics(): BiometricsService {
  return {
    isAvailable: () => Promise.resolve(false),
    authenticate: () => Promise.resolve(err('unavailable')),
  }
}
