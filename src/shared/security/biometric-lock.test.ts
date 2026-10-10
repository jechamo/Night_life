import { describe, expect, it } from 'vitest'
import { initialLockStatus, LOCK_AFTER_MS, shouldRelock } from './biometric-lock'

describe('biometric lock policy (Block 11)', () => {
  it('locks on start only when enabled, and fails closed without biometrics', () => {
    expect(initialLockStatus(false, true)).toBe('unlocked')
    expect(initialLockStatus(true, true)).toBe('locked')
    expect(initialLockStatus(true, false)).toBe('unavailable')
  })

  it('re-locks after the grace period away, never when disabled', () => {
    expect(shouldRelock(true, 0, LOCK_AFTER_MS)).toBe(true)
    expect(shouldRelock(true, 0, LOCK_AFTER_MS - 1)).toBe(false)
    expect(shouldRelock(true, null, LOCK_AFTER_MS * 10)).toBe(false)
    expect(shouldRelock(false, 0, LOCK_AFTER_MS * 10)).toBe(false)
  })
})
