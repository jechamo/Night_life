import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Illustration } from '@/shared/images/Illustration'
import { Button } from '@/shared/ui/button'
import { CheckboxField } from '@/shared/ui/checkbox'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { AiNotice } from '../components/AiNotice'
import { useStartVerification } from '../hooks/use-verification'

/**
 * "Foto verificada" and "Identidad verificada" (PRD 6.2 levels 2-3): optional,
 * each behind its own explicit consent (art. 9.2.a) that is never pre-ticked.
 */
export function OptionalVerificationScreen({ level }: { level: 'photo' | 'identity' }) {
  const { t } = useTranslation()
  const start = useStartVerification()
  const [consent, setConsent] = useState(false)
  return (
    <>
      <ScreenHeader title={t(`verification.${level}.title`)} backTo="/profile/verification" />
      <div className="px-safe mt-4 space-y-5">
        <Illustration name="verification" />
        <p className="text-muted-foreground">{t(`verification.${level}.body`)}</p>
        {level === 'photo' && <AiNotice />}
        <CheckboxField checked={consent} onCheckedChange={setConsent}>
          {t(`verification.${level}.consent`)}
        </CheckboxField>
        <p className="text-sm text-muted-foreground">{t('verification.center.neverStored')}</p>
        {level === 'identity' && (
          <p className="text-sm text-muted-foreground">{t('verification.center.testNote')}</p>
        )}
        {start.isError && (
          <p role="alert" className="text-sm text-danger">
            {t('verification.age.unavailable')}
          </p>
        )}
        <Button
          block
          size="lg"
          disabled={!consent || start.isPending}
          onClick={() => start.mutate({ level, consent })}
        >
          {t(`verification.${level}.start`)}
        </Button>
      </div>
    </>
  )
}
