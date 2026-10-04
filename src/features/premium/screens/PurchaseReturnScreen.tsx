import { CircleCheck, CircleX, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { ButtonLink } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'
import { usePurchaseStatus } from '../hooks/use-premium'

/** Return URL of external payment flows (PRD 3.3 point 5). */
export function PurchaseReturnScreen() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const requested = params.get('status') === 'success'
  const id = params.get('order')
  const { data: status } = usePurchaseStatus(
    requested && id && /^[0-9a-f-]{36}$/i.test(id) ? id : null,
  )
  const ok = status === 'paid'
  const simulated = params.get('status') === 'simulated'
  const waiting = requested && (!status || status === 'pending')
  const refunded = status === 'refunded'
  return (
    <div className="pt-safe mt-10">
      <EmptyState
        icon={ok ? CircleCheck : waiting ? Clock : CircleX}
        title={
          refunded
            ? t('premium.mine.refunded')
            : simulated
              ? t('premium.return.simulated')
              : waiting
                ? t('premium.return.processing')
                : ok
                  ? t('premium.return.success')
                  : t('premium.return.cancelled')
        }
        description={
          refunded
            ? t('premium.mine.ended')
            : simulated
              ? t('premium.return.simulatedBody')
              : waiting
                ? t('premium.return.processingBody')
                : ok
                  ? t('premium.return.successBody')
                  : t('premium.return.cancelledBody')
        }
        action={
          <ButtonLink to={ok || simulated ? '/premium/subscription' : '/premium'}>
            {ok || simulated ? t('premium.mine.cta') : t('common.back')}
          </ButtonLink>
        }
      />
    </div>
  )
}
