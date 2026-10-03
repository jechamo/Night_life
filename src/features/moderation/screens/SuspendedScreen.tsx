import { ShieldOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ButtonLink } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'

/** "Cuenta suspendida" (PRD 5.1, 6.9): explained, with the way to appeal and to leave. */
export function SuspendedScreen() {
  const { t } = useTranslation()
  return (
    <main className="pt-safe px-safe flex min-h-dvh flex-col justify-center bg-background">
      <EmptyState
        icon={ShieldOff}
        title={t('suspended.title')}
        description={t('suspended.body')}
        footnote={t('suspended.humanReview')}
        action={
          <div className="flex flex-col gap-3">
            <ButtonLink to="/suspended/moderation">{t('suspended.appeal')}</ButtonLink>
            <ButtonLink to="/profile/verification" variant="secondary">
              {t('verification.gate.verifyNow')}
            </ButtonLink>
            <ButtonLink to="/legal/delete-account" variant="ghost">
              {t('suspended.delete')}
            </ButtonLink>
          </div>
        }
      />
    </main>
  )
}
