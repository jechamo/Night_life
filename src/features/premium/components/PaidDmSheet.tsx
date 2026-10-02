import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/shared/ui/bottom-sheet'
import { Button, ButtonLink } from '@/shared/ui/button'
import { TextAreaField } from '@/shared/ui/text-field'
import { usePaidDm, usePremiumState } from '../hooks/use-premium'

/** Message before matching (`paid_dm`, one-off). Never to someone on red (PRD 6.11). */
export function PaidDmSheet({
  open,
  personId,
  name,
  onClose,
}: {
  open: boolean
  personId: string
  name: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { data: state } = usePremiumState()
  const send = usePaidDm()
  const [text, setText] = useState('')
  const credits = state?.credits.paid_dm ?? 0
  const result = send.data
  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t('premium.paidDm.title', { name })}
      description={t('premium.paidDm.body', { count: credits })}
      closeLabel={t('common.close')}
      dragHint={t('designKit.sheet.dragHint')}
    >
      {result?.ok ? (
        <p role="status" className="text-live">
          {t('premium.paidDm.sent')}
        </p>
      ) : (
        <div className="space-y-3">
          <TextAreaField
            label={t('chats.placeholder')}
            value={text}
            maxLength={300}
            onChange={(e) => setText(e.target.value)}
          />
          {result && !result.ok && (
            <p role="alert" className="text-sm text-danger">
              {t(`premium.paidDm.errors.${result.error}`)}
            </p>
          )}
          {credits > 0 ? (
            <Button
              block
              disabled={!text.trim() || send.isPending}
              onClick={() => send.mutate({ personId, text })}
            >
              {t('premium.paidDm.send')}
            </Button>
          ) : (
            <ButtonLink to="/premium" block>
              {t('premium.paidDm.buy')}
            </ButtonLink>
          )}
        </div>
      )}
    </BottomSheet>
  )
}
