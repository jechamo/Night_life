import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/shared/ui/bottom-sheet'
import { Button } from '@/shared/ui/button'
import { useWithdrawalQuote, type useSubscriptionActions } from '../hooks/use-premium'
import { formatPrice, type ProductCode } from '../model/catalog'

export interface WithdrawalTarget {
  /** Without an order: the current subscription. */
  orderId?: string
  productCode: ProductCode
}

/**
 * Withdrawal with the amount shown before confirming (PRD 6.13). The server decides:
 * unused credits in full, the part not enjoyed of a subscription or one-night pass,
 * nothing for business purchases or once the 14 days are over.
 */
export function WithdrawalSheet({
  target,
  onClose,
  withdraw,
}: {
  target: WithdrawalTarget | null
  onClose: () => void
  withdraw: ReturnType<typeof useSubscriptionActions>['withdraw']
}) {
  const { t, i18n } = useTranslation()
  const quote = useWithdrawalQuote(target ? { orderId: target.orderId } : null)
  const money = (cents: number) => formatPrice(cents, i18n.language)
  const refused = withdraw.data && !withdraw.data.ok ? withdraw.data.error : null
  const q = quote.data
  return (
    <BottomSheet
      open={target !== null}
      onOpenChange={(next) => !next && onClose()}
      title={
        target
          ? t('premium.mine.withdrawal.title', {
              product: t(`premium.products.${target.productCode}.name`),
            })
          : ''
      }
      closeLabel={t('common.close')}
      dragHint={t('designKit.sheet.dragHint')}
    >
      <div className="space-y-4 pb-2">
        {quote.isPending && (
          <p role="status" className="text-sm text-muted-foreground">
            {t('premium.mine.withdrawal.loading')}
          </p>
        )}
        {quote.isError && (
          <p role="alert" className="text-sm text-danger">
            {t('premium.mine.actionFailed')}
          </p>
        )}
        {q && !q.eligible && (
          <p className="text-sm">{t(`premium.mine.withdrawal.reasons.${q.reason}`)}</p>
        )}
        {q?.eligible && (
          <>
            <p className="font-display text-xl font-semibold">
              {t('premium.mine.withdrawal.refund', {
                refund: money(q.refundCents),
                amount: money(q.amountCents),
              })}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(`premium.mine.withdrawal.basis.${q.basis}`)}
            </p>
            {refused && (
              <p role="alert" className="text-sm text-danger">
                {t(`premium.mine.withdrawal.reasons.${refused}`)}
              </p>
            )}
            <Button
              block
              variant="danger"
              disabled={withdraw.isPending}
              onClick={() =>
                withdraw.mutate(target?.orderId, {
                  onSuccess: (result) => {
                    if (result.ok) onClose()
                  },
                })
              }
            >
              {t('premium.mine.withdrawal.confirm')}
            </Button>
          </>
        )}
        <Button block variant="outline" onClick={onClose}>
          {t('premium.mine.withdrawal.back')}
        </Button>
      </div>
    </BottomSheet>
  )
}
