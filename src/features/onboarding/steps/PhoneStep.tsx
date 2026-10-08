import { useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { LayeredInfoBox } from '@/features/legal/components/LayeredInfoBox'
import { Illustration } from '@/shared/images/Illustration'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'
import { usePostAuthPath } from '@/features/venue-panel/hooks/use-pending-invite'
import { useServices } from '@/shared/services/ServicesProvider'
import { useSignOut } from '@/shared/session/use-sign-out'
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

type Phase = 'enter' | 'code' | 'email' | 'no_account'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Phone + OTP (PRD 5.2.4). Limits and ban checks are enforced by the server.
 * `mode="login"` is the "Ya tengo cuenta" flow: same screen, no onboarding progress.
 * If the verified number already has a finished account, it goes straight to the app.
 */
export function PhoneStep({
  dispatch,
  mode = 'signup',
  onBack,
  alternate,
}: StepProps & {
  mode?: 'signup' | 'login'
  onBack?: () => void
  /** Login only: switch to another sign-in method (roadmap R1, email code). */
  alternate?: ReactNode
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const postAuthPath = usePostAuthPath()
  const { onboarding } = useServices()
  const signOut = useSignOut()
  const login = mode === 'login'
  const testTools = useFeatureFlag('test_tools_enabled') === 'on'
  const emailLogin = useFeatureFlag('email_login_enabled') === 'on'
  const [phase, setPhase] = useState<Phase>('enter')
  const [prefix, setPrefix] = useState<CountryPrefix>('+34')
  const [national, setNational] = useState('')
  const [phone, setPhone] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<RequestOtpError | VerifyOtpError | null>(null)
  const [busy, setBusy] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [resendAt, setResendAt] = useState<number | null>(null)
  const secondsLeft = useCountdown(resendAt)

  const sendCode = async (target: string) => {
    setBusy(true)
    setError(null)
    setOtpVerified(false)
    setCode('')
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
    try {
      if (!otpVerified) {
        const result = await onboarding.verifyOtp(phone, code)
        if (!result.ok) return setError(result.error)
        setOtpVerified(true)
      }
      const status = await onboarding.getStatus()
      if (status === 'completed') {
        await queryClient.invalidateQueries()
        return void navigate(await postAuthPath(), { replace: true })
      }
      setPhase(login ? 'no_account' : 'email')
    } catch {
      setError('network')
    } finally {
      setBusy(false)
    }
  }

  const changeNumber = () => {
    setError(null)
    const clearForm = () => {
      setOtpVerified(false)
      setCode('')
      setPhone(null)
      setPhase('enter')
    }
    if (!otpVerified) return clearForm()
    signOut.mutate(undefined, {
      onSuccess: clearForm,
      onError: () => setError('network'),
    })
  }

  const emailInvalid = email !== '' && !EMAIL.test(email)
  const errorText = error ? t(`onboarding.phone.errors.${error}`) : undefined

  if (phase === 'no_account') {
    return (
      <OnboardingStepLayout
        title={t('onboarding.login.noAccountTitle')}
        description={t('onboarding.login.noAccountBody')}
      >
        {errorText && (
          <p role="alert" className="text-sm text-danger">
            {errorText}
          </p>
        )}
        <Button
          block
          onClick={() => void navigate('/onboarding', { replace: true })}
          disabled={signOut.isPending}
        >
          {t('onboarding.login.noAccountComplete')}
        </Button>
        <Button block variant="outline" onClick={changeNumber} disabled={signOut.isPending}>
          {t('onboarding.login.noAccountOtherNumber')}
        </Button>
      </OnboardingStepLayout>
    )
  }

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
        {emailLogin && <p className="text-sm text-live">{t('onboarding.phone.emailLoginHint')}</p>}
      </OnboardingStepLayout>
    )
  }

  if (phase === 'code' && phone) {
    return (
      <OnboardingStepLayout
        step={login ? undefined : 'phone'}
        title={t('onboarding.phone.codeTitle')}
        description={t('onboarding.phone.codeSentTo', { phone: maskPhone(phone) })}
        onBack={changeNumber}
        footer={
          <Button
            block
            size="lg"
            disabled={!isOtpFormat(code) || busy}
            onClick={() => void onVerify()}
          >
            {t(otpVerified ? 'common.retry' : 'onboarding.phone.verify')}
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
        {testTools && onboarding.testOtpCode && (
          <p className="text-sm text-live">
            {t('onboarding.phone.testHint', { code: onboarding.testOtpCode })}
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
          <Button variant="ghost" size="sm" onClick={changeNumber} disabled={signOut.isPending}>
            {t('onboarding.phone.changeNumber')}
          </Button>
        </div>
      </OnboardingStepLayout>
    )
  }

  return (
    <OnboardingStepLayout
      step={login ? undefined : 'phone'}
      title={login ? t('onboarding.login.title') : t('onboarding.phone.title')}
      description={login ? t('onboarding.login.body') : t('onboarding.phone.body')}
      onBack={onBack ?? (() => dispatch({ type: 'BACK' }))}
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
      {alternate}
    </OnboardingStepLayout>
  )
}
