import { BadgeCheck, Flag, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CONFIRMATIONS_NEEDED } from '@/features/events/model/events'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { useConfirmEvent, useReportEvent } from '../hooks/use-places'
import type { Place, PlaceEvent } from '../model/types'
import type { EventReportReason } from '../services/places-service'

const REASONS: readonly EventReportReason[] = ['fake', 'dangerous', 'inappropriate']

/** Event-only block (PRD 6.7): status, safety warning, "Confirmo que existe" and "Reportar". */
export function EventActions({ place, event }: { place: Place; event: PlaceEvent }) {
  const { t } = useTranslation()
  const confirm = useConfirmEvent()
  const report = useReportEvent()
  const [reporting, setReporting] = useState(false)
  const unconfirmed = event.status === 'unconfirmed'
  const confirmError = confirm.error?.message

  return (
    <section aria-label={t('places.event.title')} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={unconfirmed ? 'unconfirmed' : 'verified'}>
          {t(`places.event.status.${event.status}`)}
        </Badge>
        <span className="font-label text-xs text-muted-foreground">
          {t(`places.event.origin.${event.origin}`)}
        </span>
      </div>
      <p className="leading-relaxed">{event.description}</p>
      {unconfirmed && (
        <>
          <div className="flex gap-2 rounded-2xl border border-warning bg-surface p-3 text-sm">
            <ShieldAlert className="size-5 shrink-0 text-warning" aria-hidden />
            <p>{t('places.event.safety')}</p>
          </div>
          <Button
            block
            variant="outline"
            disabled={confirm.isPending || confirm.isSuccess}
            onClick={() => confirm.mutate(place.id)}
          >
            <BadgeCheck aria-hidden />
            {t('places.event.confirm', { count: event.confirmations, total: CONFIRMATIONS_NEEDED })}
          </Button>
          {confirmError && (
            <p role="alert" className="text-sm text-warning">
              {t(
                `places.event.errors.${confirmError === 'already_confirmed' ? 'already' : 'notAvailable'}`,
              )}
            </p>
          )}
        </>
      )}
      {reporting ? (
        <div
          role="group"
          aria-label={t('places.event.reportTitle')}
          className="flex flex-wrap gap-2"
        >
          {REASONS.map((reason) => (
            <Button
              key={reason}
              size="sm"
              variant="outline"
              disabled={report.isPending}
              onClick={() =>
                report.mutate(
                  { placeId: place.id, reason },
                  { onSuccess: () => setReporting(false) },
                )
              }
            >
              {t(`places.event.reasons.${reason}`)}
            </Button>
          ))}
        </div>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setReporting(true)}>
          <Flag aria-hidden />
          {t('places.event.report')}
        </Button>
      )}
      {report.isSuccess && (
        <p role="status" className="text-sm text-live">
          {t('places.event.reported')}
        </p>
      )}
    </section>
  )
}
