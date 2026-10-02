import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LayeredInfoBox } from '@/features/legal/components/LayeredInfoBox'
import { MOCK_OTP_CODE } from '@/mocks/mock-auth-services'
import { Illustration } from '@/shared/images/Illustration'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'
import { useServices } from '@/shared/services/ServicesProvider'
import { Button } from '@/shared/ui/button'
import { TextField } from '@/shared/ui/text-field'
import { OnboardingStepLayout } from '../components/OnboardingStepLayout'
import { useCountdown } from '../hooks/use-countdown'
import {
  COUNTRY_PREFIXES,
  isOtpFormat,
  maskPhone,
  OTP_LENGTH,
  toE164,
  type CountryPrefix,
} from '../model/phone'
import type { RequestOtpError, VerifyOtpError } from '../services/onboarding-service'
import type { StepProps } from './types'

type Phase = 'enter' | 'code' | 'email'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Phone + OTP (PRD 5.2.4). Limits and ban checks are enforced by the server. */
export function PhoneStep({ dispatch }: StepProps) {
  const { t } = useTranslation()
  const { onboarding } = useServices()
  const testTools = useFeatureFlag('test_tools_enabled') === 'on'
  const [phase, setPhase] = useState<Phase>('enter')
  const [prefix, setPrefix] = useState<CountryPrefix>('+34')
  const [national, setNational] = useState('')
  const [phone, setPhone] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<RequestOtpError | VerifyOtpError | null>(null)
  const [busy, setBusy] = useState(false)
  const [resendAt, setResendAt] = useState<number | null>(null)
  const secondsLeft = useCountdown(resendAt)

  const sendCode = async (target: string) => {
    setBusy(true)
    setError(null)
    const result = await onboarding.requestOtp(target)
    setBusy(false)
    if (!result.ok) return setError(result.error)
    setPhone(target)
    setResendAt(Date.now() + result.value.resendAfterSeconds * 1000)
    setPhase('code')
  }

  const onSend = () => {
    const e164 = toE164(prefix, national)
    if (!e164) return setError('invalid_phone')
    void sendCode(e164)
  }

  const onVerify = async () => {
    if (!phone) return
    setBusy(true)
    setError(null)
    const result = await onboarding.verifyOtp(phone, code)
    setBusy(false)
    if (!result.ok) return setError(result.error)
    setPhase('email')
  }

  const emailInvalid = email !== '' && !EMAIL.test(email)
  const errorText = error ? t(`onboarding.phone.errors.${error}`) : undefined

  if (phase === 'email' && phone) {
    return (
      <OnboardingStepLayout
        step="phone"
        title={t('onboarding.phone.emailLabel')}
        footer={
          <Button
            block
            size="lg"
            disabled={emailInvalid}
            onClick={() => dispatch({ type: 'PHONE_VERIFIED', phone, ...(email ? { email } : {}) })}
          >
            {email ? t('common.continue') : t('common.skip')}
          </Button>
        }
      >
        <TextField
          type="email"
          autoComplete="email"
          label={t('onboarding.phone.emailLabel')}
          hint={t('onboarding.phone.emailHint')}
          error={emailInvalid ? t('onboarding.phone.emailInvalid') : undefined}
          value={email}
          onChange={(event) => setEmail(event.target.value.trim())}
        />
      </OnboardingStepLayout>
    )
  }

  if (phase === 'code' && phone) {
    return (
      <OnboardingStepLayout
        step="phone"
        title={t('onboarding.phone.codeTitle')}
        description={t('onboarding.phone.codeSentTo', { phone: maskPhone(phone) })}
        onBack={() => setPhase('enter')}
        footer={
          <Button
            block
            size="lg"
            disabled={!isOtpFormat(code) || busy}
            onClick={() => void onVerify()}
          >
            {t('onboarding.phone.verify')}
          </Button>
        }
      >
        <TextField
          label={t('onboarding.phone.codeLabel')}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={OTP_LENGTH}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          error={errorText}
          className="font-display text-center text-2xl tracking-[0.5em]"
        />
        {testTools && (
          <p className="text-sm text-live">
            {t('onboarding.phone.testHint', { code: MOCK_OTP_CODE })}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={secondsLeft > 0 || busy}
            onClick={() => void sendCode(phone)}
          >
            {secondsLeft > 0
              ? t('onboarding.phone.resendIn', { seconds: secondsLeft })
              : t('onboarding.phone.resend')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setPhase('enter')}>
            {t('onboarding.phone.changeNumber')}
          </Button>
        </div>
      </OnboardingStepLayout>
    )
  }

  return (
    <OnboardingStepLayout
      step="phone"
      title={t('onboarding.phone.title')}
      description={t('onboarding.phone.body')}
      onBack={() => dispatch({ type: 'BACK' })}
      hero={<Illustration name="phoneOtp" className="mt-2 size-36" />}
      footer={
        <Button block size="lg" disabled={!national || busy} onClick={onSend}>
          {t('onboarding.phone.send')}
        </Button>
      }
    >
      <div className="grid grid-cols-[6.5rem_1fr] gap-3">
        <div className="space-y-1.5">
          <label htmlFor="phone-prefix" className="text-sm font-medium">
            {t('onboarding.phone.prefix')}
          </label>
          <select
            id="phone-prefix"
            value={prefix}
            onChange={(event) => setPrefix(event.target.value as CountryPrefix)}
            className="h-12 w-full rounded-2xl border border-border bg-surface px-3 text-base text-foreground"
          >
            {COUNTRY_PREFIXES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <TextField
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          label={t('onboarding.phone.number')}
          value={national}
          onChange={(event) => {
            setNational(event.target.value)
            setError(null)
          }}
          error={errorText}
        />
      </div>
      <LayeredInfoBox form="phone" />
    </OnboardingStepLayout>
  )
}
