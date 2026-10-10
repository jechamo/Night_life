import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBiometricLock } from '@/shared/security/biometric-lock-context'
import { GlassCard } from '@/shared/ui/card'
import { Section } from '@/shared/ui/section'
import { Switch } from '@/shared/ui/switch'

/** Block 11: only shown where the device offers Face ID / fingerprint (native app). */
export function BiometricLockSection() {
  const { t } = useTranslation()
  const { available, enabled, setEnabled } = useBiometricLock()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const switchId = useId()
  const descriptionId = useId()
  if (!available) return null

  const toggle = async (next: boolean) => {
    setBusy(true)
    setFailed(false)
    const changed = await setEnabled(next)
    setBusy(false)
    if (!changed) setFailed(true)
  }

  return (
    <Section title={t('settings.biometricLock.title')}>
      <GlassCard>
        <div className="flex items-center gap-4">
          <label htmlFor={switchId} className="flex-1 cursor-pointer py-1">
            <span className="block font-medium">{t('settings.biometricLock.label')}</span>
            <span id={descriptionId} className="block text-sm text-muted-foreground">
              {t('settings.biometricLock.description')}
            </span>
          </label>
          <Switch
            id={switchId}
            aria-describedby={descriptionId}
            checked={enabled}
            disabled={busy}
            onCheckedChange={(next) => void toggle(next)}
          />
        </div>
        {failed && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {t('settings.biometricLock.enableFailed')}
          </p>
        )}
      </GlassCard>
    </Section>
  )
}
