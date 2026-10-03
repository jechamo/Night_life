import { ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, ButtonLink } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'
import { Skeleton } from '@/shared/ui/skeleton'
import { useVerificationSnapshot } from '../hooks/use-verification'
import { canPerform, type AgeGatedAction } from '../model/verification'

/** Direct URLs cannot render cached profiles or chats without the current age result. */
export function AgeVerifiedRoute({
  action,
  children,
}: {
  action: AgeGatedAction
  children: ReactNode
}) {
  const { t } = useTranslation()
  const snapshot = useVerificationSnapshot()
  if (snapshot.isPending) return <Skeleton className="m-4 h-96" />
  if (!snapshot.isError && canPerform(action, snapshot.data)) return children
  return (
    <EmptyState
      icon={ShieldCheck}
      title={t('verification.gate.title')}
      description={
        snapshot.isError
          ? t('verification.center.loadFailed')
          : t('verification.gate.body', { action: t(`verification.gate.actions.${action}`) })
      }
      action={
        snapshot.isError ? (
          <Button disabled={snapshot.isFetching} onClick={() => void snapshot.refetch()}>
            {t('verification.center.refresh')}
          </Button>
        ) : (
          <ButtonLink to="/profile/verification">{t('verification.gate.verifyNow')}</ButtonLink>
        )
      }
    />
  )
}
