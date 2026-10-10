import { RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/button'
import { useStoreBilling } from '../hooks/use-store'

/** Required by the stores: brings back purchases made on another device or reinstall. */
export function RestorePurchasesButton() {
  const { t } = useTranslation()
  const billing = useStoreBilling()
  if (!billing.enabled) return null
  const result = billing.restore.data
  return (
    <div className="space-y-2">
      <Button
        block
        variant="outline"
        size="sm"
        disabled={!billing.ready || billing.restore.isPending}
        onClick={() => billing.restore.mutate()}
      >
        <RotateCcw aria-hidden />
        {t('premium.store.restore')}
      </Button>
      {result && (
        <p
          role={result.ok ? 'status' : 'alert'}
          className={result.ok ? 'text-sm text-live' : 'text-sm text-danger'}
        >
          {result.ok ? t('premium.store.restored') : t(`premium.store.errors.${result.error}`)}
        </p>
      )}
    </div>
  )
}
