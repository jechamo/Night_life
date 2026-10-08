import { useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Illustration } from '@/shared/images/Illustration'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'
import { useServices } from '@/shared/services/ServicesProvider'
import { Button } from '@/shared/ui/button'
import { TextField } from '@/shared/ui/text-field'
import { OnboardingStepLayout } from '../components/OnboardingStepLayout'
import { useCountdown } from '../hooks/use-countdown'
import { isOtpFormat, OTP_LENGTH } from '../model/phone'
import type { RequestEmailOtpError, VerifyOtpError } from '../services/onboarding-service'

type Phase = 'enter' | 'code' | 'no_account'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Roadmap R1: returning users sign in with a code sent to their verified email, so a
 * new session does not cost an SMS. Accounts are still created only through the phone
 * sign-up. The copy never reveals whether an address has an account.
 */
export function EmailLoginStep({
  onBack,
  alternate,
}: {
  onBack: () => void
  /** "Sign in with SMS" switch, rendered by the login screen. */
  alternate?: ReactNode
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { onboarding } = useServices()
  const testTools = useFeatureFlag('test_tools_enabled') === 'on'
  const [phase, setPhase] = useState<Phase>('enter')
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<RequestEmailOtpError | VerifyOtpError | null>(null)
  const [busy, setBusy] = useState(false)
  const [resendAt, setResendAt] = useState<number | null>(null)
  const secondsLeft = useCountdown(resendAt)

  const sendCode = async (target: string) => {
    setBusy(true)
    setError(null)
    setCode('')
    const result = await onboarding.requestEmailOtp(target)
    setBusy(false)
    if (!result.ok) return setError(result.error)
    setSentTo(target)
    setResendAt(Date.now() + result.value.resendAfterSeconds * 1000)
    setPhase('code')
  }

  const onSend = () => {
    const target = email.trim().toLowerCase()
    if (!EMAIL.test(target)) return setError('invalid_email')
    void sendCode(target)
  }

  const onVerify = async () => {
    if (!sentTo) return
    setBusy(true)
    setError(null)
    try {
      const result = await onboarding.verifyEmailOtp(sentTo, code)
      if (!result.ok) return setError(result.error)
      if ((await onboarding.getStatus()) === 'completed') {
        await queryClient.invalidateQueries()
        return void navigate('/home', { replace: true })
      }
      setPhase('no_account')
    } catch {
      setError('network')
    } finally {
      setBusy(false)
    }
  }

  const useAnotherEmail = () => {
    setError(null)
    setCode('')
    setSentTo(null)
    setPhase('enter')
  }

  const errorText = error
    ? error === 'invalid_email'
      ? t('onboarding.phone.emailInvalid')
      : t(`onboarding.phone.errors.${error}`)
    : undefined

  if (phase === 'no_account') {
    return (
      <OnboardingStepLayout
        title={t('onboarding.login.noAccountTitle')}
        description={t('onboarding.login.noAccountBody')}
      >
        <Button block onClick={() => void navigate('/onboarding', { replace: true })}>
          {t('onboarding.login.noAccountComplete')}
        </Button>
      </OnboardingStepLayout>
    )
  }

  if (phase === 'code' && sentTo) {
    return (
      <OnboardingStepLayout
        title={t('onboarding.phone.codeTitle')}
        description={t('onboarding.login.emailSentTo', { email: sentTo })}
        onBack={useAnotherEmail}
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
        {testTools && onboarding.testOtpCode && (
          <p className="text-sm text-live">
            {t('onboarding.phone.testHint', { code: onboarding.testOtpCode })}
          </p>
        )}
        <p className="text-sm text-muted-foreground">{t('onboarding.login.emailNotArrived')}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={secondsLeft > 0 || busy}
            onClick={() => void sendCode(sentTo)}
          >
            {secondsLeft > 0
              ? t('onboarding.phone.resendIn', { seconds: secondsLeft })
              : t('onboarding.phone.resend')}
          </Button>
          <Button variant="ghost" size="sm" onClick={useAnotherEmail}>
            {t('onboarding.login.changeEmail')}
          </Button>
        </div>
        {alternate}
      </OnboardingStepLayout>
    )
  }

  return (
    <OnboardingStepLayout
      title={t('onboarding.login.emailTitle')}
      description={t('onboarding.login.emailBody')}
      onBack={onBack}
      hero={<Illustration name="phoneOtp" className="mt-2 size-36" />}
      footer={
        <Button block size="lg" disabled={!email.trim() || busy} onClick={onSend}>
          {t('onboarding.login.emailSend')}
        </Button>
      }
    >
      <TextField
        type="email"
        inputMode="email"
        autoComplete="email"
        label={t('onboarding.login.emailLabel')}
        value={email}
        onChange={(event) => {
          setEmail(event.target.value)
          setError(null)
        }}
        error={errorText}
      />
      {alternate}
    </OnboardingStepLayout>
  )
}
