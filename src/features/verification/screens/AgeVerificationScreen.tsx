import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Illustration } from '@/shared/images/Illustration'
import { Button } from '@/shared/ui/button'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { AiNotice } from '../components/AiNotice'
import { SimulationFallback } from '../components/SimulationFallback'
import { useRequestHumanReview, useStartVerification } from '../hooks/use-verification'

/** Informative screen before the provider flow (PRD 6.2 level 1): method, AI notice, alternatives. */
export function AgeVerificationScreen() {
  const { t } = useTranslation()
  const start = useStartVerification()
  const review = useRequestHumanReview()
  const navigate = useNavigate()
  return (
    <>
      <ScreenHeader title={t('verification.age.title')} backTo="/profile/verification" />
      <div className="px-safe mt-4 space-y-5">
        <Illustration name="verification" />
        <p className="text-muted-foreground">{t('verification.age.body')}</p>
        <ul className="space-y-2">
          {(['how1', 'how2'] as const).map((key) => (
            <li key={key} className="flex gap-2">
              <Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
              <span>{t(`verification.age.${key}`)}</span>
            </li>
          ))}
        </ul>
        <AiNotice />
        <p className="text-sm text-muted-foreground">{t('verification.center.neverStored')}</p>
        <p className="text-sm text-muted-foreground">{t('verification.center.testNote')}</p>
        {start.isError && (
          <>
            <p role="alert" className="text-sm text-danger">
              {t('verification.age.unavailable')}
            </p>
            <SimulationFallback
              disabled={start.isPending || review.isPending}
              onChoose={() => start.mutate({ level: 'age', method: 'document', simulate: true })}
            />
          </>
        )}
        {review.isError && (
          <p role="alert" className="text-sm text-danger">
            {t('verification.center.reviewFailed')}
          </p>
        )}
        <div className="grid gap-3 pb-4">
          <Button
            size="lg"
            disabled={start.isPending || review.isPending}
            onClick={() => start.mutate({ level: 'age', method: 'facial_estimation' })}
          >
            {t('verification.age.start')}
          </Button>
          <Button
            variant="outline"
            disabled={start.isPending || review.isPending}
            onClick={() => start.mutate({ level: 'age', method: 'document' })}
          >
            {t('verification.age.otherMethod')}
          </Button>
          <Button
            variant="ghost"
            disabled={start.isPending || review.isPending}
            onClick={() =>
              review.mutate('age', {
                onSuccess: () => void navigate('/profile/verification'),
              })
            }
          >
            {t('verification.actions.requestReview')}
          </Button>
        </div>
      </div>
    </>
  )
}
