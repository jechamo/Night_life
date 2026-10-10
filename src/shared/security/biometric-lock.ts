/** Short trips (permission sheets, the biometric prompt itself) do not re-lock the app. */
export const LOCK_AFTER_MS = 30_000

export type LockStatus = 'unlocked' | 'locked' | 'unavailable'

/**
 * State on start: an enabled lock is always shown on a cold start. If biometrics
 * disappeared since it was enabled, the app stays closed (fail closed) and only
 * offers signing out, which then requires the normal OTP login.
 */
export function initialLockStatus(enabled: boolean, available: boolean): LockStatus {
  if (!enabled) return 'unlocked'
  return available ? 'locked' : 'unavailable'
}

/** Whether returning to the foreground must lock again. */
export function shouldRelock(enabled: boolean, hiddenAt: number | null, now: number): boolean {
  return enabled && hiddenAt !== null && now - hiddenAt >= LOCK_AFTER_MS
}
