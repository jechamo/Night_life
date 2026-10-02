import type { Result } from '@/shared/lib/result'

export type BiometricError = 'unavailable' | 'failed' | 'cancelled'

/** Port for biometric unlock (native only, Annex B). */
export interface BiometricsService {
  isAvailable(): Promise<boolean>
  authenticate(reason: string): Promise<Result<void, BiometricError>>
}
