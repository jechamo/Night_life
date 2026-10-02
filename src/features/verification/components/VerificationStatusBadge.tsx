import { useTranslation } from 'react-i18next'
import { Badge } from '@/shared/ui/badge'
import type { VerificationStatus } from '../model/verification'

const TONE = {
  not_started: 'neutral',
  pending: 'live',
  manual_review: 'unconfirmed',
  verified: 'verified',
  failed: 'unconfirmed',
  reverification_required: 'unconfirmed',
} as const

export function VerificationStatusBadge({ status }: { status: VerificationStatus }) {
  const { t } = useTranslation()
  return (
    <Badge tone={TONE[status.state]} stampIn={status.state === 'verified'}>
      {t(`verification.states.${status.state}`)}
    </Badge>
  )
}
