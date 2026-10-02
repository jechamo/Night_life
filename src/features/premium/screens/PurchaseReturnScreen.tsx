import { CircleCheck, CircleX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { ButtonLink } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'

/** Return URL of external payment flows (PRD 3.3 point 5). */
export function PurchaseReturnScreen() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const ok = params.get('status') === 'success'
  return (
    <div className="pt-safe mt-10">
      <EmptyState
        icon={ok ? CircleCheck : CircleX}
        title={ok ? t('premium.return.success') : t('premium.return.cancelled')}
        description={ok ? t('premium.return.successBody') : t('premium.return.cancelledBody')}
        action={
          <ButtonLink to={ok ? '/premium/subscription' : '/premium'}>
            {ok ? t('premium.mine.cta') : t('common.back')}
          </ButtonLink>
        }
      />
    </div>
  )
}
