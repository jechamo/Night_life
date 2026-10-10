import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '@/platform'
import { PREFERENCE_KEYS } from '@/shared/config/preferences'
import { BiometricLockScreen } from './BiometricLockScreen'
import { initialLockStatus, shouldRelock, type LockStatus } from './biometric-lock'
import { BiometricLockContext } from './biometric-lock-context'

/**
 * Block 11 (ROADMAP_2026-10): local Face ID / fingerprint gate over the saved session.
 * It never grants roles, entitlements or a session. While locked, the app stays
 * mounted (drafts survive) but is inert and fully covered.
 */
export function BiometricLockProvider({
  initialEnabled,
  children,
}: Readonly<{
  initialEnabled: boolean
  children: ReactNode
}>) {
  const { biometrics, preferences, appState } = usePlatform()
  const { t } = useTranslation()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [available, setAvailable] = useState(false)
  // Never prompt before knowing whether the device can answer.
  const [checked, setChecked] = useState(false)
  const [status, setStatus] = useState<LockStatus>(initialEnabled ? 'locked' : 'unlocked')
  // Lifecycle listeners are registered once and read the current values from here.
  const latest = useRef({ enabled, available })
  useEffect(() => {
    latest.current = { enabled, available }
  }, [enabled, available])
  const hiddenAt = useRef<number | null>(null)

  useEffect(() => {
    let active = true
    void biometrics.isAvailable().then((value) => {
      if (!active) return
      setAvailable(value)
      setChecked(true)
      setStatus((current) =>
        current === 'locked' ? initialLockStatus(latest.current.enabled, value) : current,
      )
    })
    return () => {
      active = false
    }
  }, [biometrics])

  useEffect(
    () =>
      appState.onActiveChange((active) => {
        if (!active) {
          hiddenAt.current ??= Date.now()
          return
        }
        const { enabled: on, available: can } = latest.current
        if (shouldRelock(on, hiddenAt.current, Date.now()))
          setStatus(can ? 'locked' : 'unavailable')
        hiddenAt.current = null
      }),
    [appState],
  )

  const authenticate = useCallback(
    () => biometrics.authenticate(t('settings.biometricLock.reason')),
    [biometrics, t],
  )

  const changeEnabled = useCallback(
    async (next: boolean) => {
      if (next) {
        const result = await authenticate()
        if (!result.ok) return false
        await preferences.set(PREFERENCE_KEYS.biometricLock, 'on')
      } else {
        await preferences.remove(PREFERENCE_KEYS.biometricLock)
      }
      setEnabled(next)
      return true
    },
    [authenticate, preferences],
  )

  const reset = useCallback(async () => {
    await preferences.remove(PREFERENCE_KEYS.biometricLock)
    setEnabled(false)
    setStatus('unlocked')
  }, [preferences])

  const value = useMemo(
    () => ({ available, enabled, setEnabled: changeEnabled, reset }),
    [available, enabled, changeEnabled, reset],
  )
  const locked = status !== 'unlocked'

  return (
    <BiometricLockContext value={value}>
      <div className="contents" inert={locked} aria-hidden={locked || undefined}>
        {children}
      </div>
      {locked && (
        <BiometricLockScreen
          ready={checked}
          unavailable={status === 'unavailable'}
          authenticate={authenticate}
          onUnlocked={() => setStatus('unlocked')}
          onUnavailable={() => setStatus('unavailable')}
        />
      )}
    </BiometricLockContext>
  )
}
