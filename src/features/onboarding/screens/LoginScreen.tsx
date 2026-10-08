import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'
import { Button } from '@/shared/ui/button'
import { EmailLoginStep } from '../steps/EmailLoginStep'
import { PhoneStep } from '../steps/PhoneStep'

/**
 * "Ya tengo cuenta": phone + OTP; a finished account goes straight to the app.
 * With `email_login_enabled` (roadmap R1) the email code is offered first and SMS stays
 * one tap away; with the flag off this screen is exactly the phone flow.
 */
export function LoginScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const emailLogin = useFeatureFlag('email_login_enabled') === 'on'
  const [method, setMethod] = useState<'email' | 'sms'>('email')
  const back = () => void navigate('/welcome')

  if (emailLogin && method === 'email') {
    return (
      <EmailLoginStep
        onBack={back}
        alternate={
          <Button block variant="ghost" onClick={() => setMethod('sms')}>
            {t('onboarding.login.useSms')}
          </Button>
        }
      />
    )
  }
  return (
    <PhoneStep
      mode="login"
      data={{}}
      dispatch={() => undefined}
      onBack={back}
      alternate={
        emailLogin ? (
          <Button block variant="ghost" onClick={() => setMethod('email')}>
            {t('onboarding.login.useEmail')}
          </Button>
        ) : undefined
      }
    />
  )
}
