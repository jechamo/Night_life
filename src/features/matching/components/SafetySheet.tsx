import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/shared/ui/bottom-sheet'
import { Button } from '@/shared/ui/button'
import { SingleChoice } from '@/shared/ui/choice-group'
import { TextAreaField } from '@/shared/ui/text-field'
import { useSafetyActions } from '../hooks/use-matching'
import type { ReportReason } from '../services/matching-service'

export type SafetyAction = 'report' | 'block' | 'unmatch'
const REASONS: readonly ReportReason[] = [
  'possible_minor',
  'harassment',
  'feel_followed',
  'fake_profile',
  'inappropriate',
  'spam',
  'other',
]

/**
 * Report (incl. "posible menor" and "Me siento seguido/a"), block (mutual, instant)
 * and delete match (for both) — PRD 6.6, 6.9, 6.15 D.
 */
export function SafetySheet({
  action,
  personId,
  personName,
  matchId,
  onClose,
  onDone,
}: {
  action: SafetyAction | null
  personId: string
  personName: string
  matchId?: string
  onClose: () => void
  onDone: (action: SafetyAction) => void
}) {
  const { t } = useTranslation()
  const { report, block, unmatch } = useSafetyActions()
  const [reason, setReason] = useState<ReportReason | undefined>()
  const [comment, setComment] = useState('')
  const busy = report.isPending || block.isPending || unmatch.isPending

  const confirm = () => {
    if (action === 'report' && reason) {
      report.mutate({ personId, reason, comment }, { onSuccess: () => onDone('report') })
    } else if (action === 'block') {
      block.mutate(personId, { onSuccess: () => onDone('block') })
    } else if (action === 'unmatch' && matchId) {
      unmatch.mutate(matchId, { onSuccess: () => onDone('unmatch') })
    }
  }

  return (
    <BottomSheet
      open={action !== null}
      onOpenChange={(open) => !open && onClose()}
      title={action ? t(`safety.${action}.title`, { name: personName }) : ''}
      description={action ? t(`safety.${action}.body`, { name: personName }) : undefined}
      closeLabel={t('common.close')}
      dragHint={t('designKit.sheet.dragHint')}
    >
      {action === 'report' && (
        <div className="space-y-4">
          <SingleChoice<ReportReason>
            label={t('safety.report.reason')}
            value={reason}
            onChange={setReason}
            options={REASONS.map((r) => ({ value: r, label: t(`safety.reasons.${r}`) }))}
          />
          <TextAreaField
            label={t('safety.report.comment')}
            value={comment}
            maxLength={500}
            onChange={(event) => setComment(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t('safety.report.humanReview')}</p>
        </div>
      )}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={onClose}>
          {t('verification.gate.notNow')}
        </Button>
        <Button
          variant="danger"
          disabled={busy || (action === 'report' && !reason)}
          onClick={confirm}
        >
          {action ? t(`safety.${action}.confirm`) : ''}
        </Button>
      </div>
    </BottomSheet>
  )
}
