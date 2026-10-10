import { LockKeyhole } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BiometricError } from '@/platform'
import type { Result } from '@/shared/lib/result'
import { useSignOut } from '@/shared/session/use-sign-out'
import { Button } from '@/shared/ui/button'

export function BiometricLockScreen({
  ready,
  unavailable,
  authenticate,
  onUnlocked,
  onUnavailable,
}: Readonly<{
  ready: boolean
  unavailable: boolean
  authenticate: () => Promise<Result<void, BiometricError>>
  onUnlocked: () => void
  onUnavailable: () => void
}>) {
  const { t } = useTranslation()
  const signOut = useSignOut()
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const prompted = useRef(false)

  const unlock = async () => {
    setBusy(true)
    const result = await authenticate()
    setBusy(false)
    if (result.ok) return onUnlocked()
    if (result.error === 'unavailable') return onUnavailable()
    // Cancelling is a choice, not an error: the button stays available.
    setFailed(result.error === 'failed')
  }

  // Ask once automatically; afterwards only on an explicit tap.
  useEffect(() => {
    if (!ready || unavailable || prompted.current) return
    prompted.current = true
    void unlock()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one automatic prompt per lock
  }, [ready, unavailable])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="biometric-lock-title"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background px-safe pt-safe pb-safe text-center text-foreground"
    >
      <span className="grid size-20 place-items-center rounded-full bg-surface-raised text-primary">
        <LockKeyhole aria-hidden className="size-9" />
      </span>
      <div className="max-w-sm space-y-2">
        <h1 id="biometric-lock-title" className="font-display text-2xl font-semibold">
          {t('settings.biometricLock.lockTitle')}
        </h1>
        <p className="text-muted-foreground">
          {unavailable
            ? t('settings.biometricLock.unavailable')
            : t('settings.biometricLock.lockBody')}
        </p>
        {failed && !unavailable && (
          <p role="alert" className="text-sm text-danger">
            {t('settings.biometricLock.failed')}
          </p>
        )}
      </div>
      <div className="flex w-full max-w-sm flex-col gap-3">
        {!unavailable && (
          <Button block autoFocus disabled={busy || !ready} onClick={() => void unlock()}>
            {t('settings.biometricLock.unlock')}
          </Button>
        )}
        <Button
          block
          variant="ghost"
          disabled={signOut.isPending}
          // Signing out also switches the lock off (useSignOut), so the login shows.
          onClick={() => signOut.mutate()}
        >
          {t('settings.biometricLock.signOut')}
        </Button>
      </div>
    </div>
  )
}
