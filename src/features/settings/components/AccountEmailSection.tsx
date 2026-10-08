import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { Section } from '@/shared/ui/section'
import { TextField } from '@/shared/ui/text-field'
import { useAccountEmail, useChangeEmail } from '../hooks/use-account-email'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Settings › Account: add or change the email used to sign in without SMS. */
export function AccountEmailSection() {
  const { t } = useTranslation()
  const account = useAccountEmail()
  const change = useChangeEmail()
  const [value, setValue] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const target = value.trim().toLowerCase()
  const invalid = target !== '' && !EMAIL.test(target)
  const failure = change.data && !change.data.ok ? change.data.error : null
  const current = account.data

  const save = () =>
    change.mutate(target, {
      onSuccess: (result) => {
        if (!result.ok) return
        setSentTo(target)
        setValue('')
      },
    })

  return (
    <Section title={t('settings.account.title')}>
      <GlassCard className="space-y-4">
        <div>
          <p className="font-medium">{t('settings.account.email')}</p>
          {current && (
            <p className="text-sm text-muted-foreground">
              {current.email
                ? `${current.email} · ${
                    current.confirmed
                      ? t('settings.account.verified')
                      : t('settings.account.unverified')
                  }`
                : t('settings.account.none')}
            </p>
          )}
          {current?.pendingEmail && (
            <p className="text-sm text-live">
              {t('settings.account.pending', { email: current.pendingEmail })}
            </p>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{t('settings.account.hint')}</p>
        <TextField
          type="email"
          inputMode="email"
          autoComplete="email"
          label={t('settings.account.newEmail')}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          error={
            invalid
              ? t('settings.account.errors.invalid_email')
              : failure
                ? t(`settings.account.errors.${failure}`)
                : undefined
          }
        />
        <Button block disabled={!target || invalid || change.isPending} onClick={save}>
          {t('settings.account.save')}
        </Button>
        {sentTo && (
          <p role="status" className="text-sm text-live">
            {t('settings.account.sent', { email: sentTo })}
          </p>
        )}
      </GlassCard>
    </Section>
  )
}
