import { Compass } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ButtonLink } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'

export function NotFoundScreen() {
  const { t } = useTranslation()
  return (
    <div className="pt-safe flex min-h-dvh items-center justify-center">
      <EmptyState
        icon={Compass}
        title={t('errors.notFound.title')}
        description={t('errors.notFound.description')}
        action={<ButtonLink to="/discover">{t('errors.notFound.action')}</ButtonLink>}
      />
    </div>
  )
}
