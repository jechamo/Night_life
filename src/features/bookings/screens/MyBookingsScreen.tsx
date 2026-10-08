import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { QrCode } from '@/shared/ui/qr-code'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Section } from '@/shared/ui/section'
import { useBookingFormat } from '../components/PlaceBookingSection'
import {
  useBookingsEnabled,
  useCancelReservation,
  useLeaveGuestlist,
  useMyBookings,
} from '../hooks/use-bookings'
import { formatGuestCode, guestQrPayload, isActiveReservation } from '../model/bookings'

/** Roadmap R5 «Mis reservas»: venue answers and guest list entries with their QR. */
export function MyBookingsScreen() {
  const { t } = useTranslation()
  const enabled = useBookingsEnabled()
  const { data, isPending } = useMyBookings(enabled)
  const cancel = useCancelReservation()
  const leave = useLeaveGuestlist()
  const format = useBookingFormat()
  if (!enabled) return <Navigate to="/profile" replace />
  const empty = !isPending && data && data.reservations.length === 0 && data.entries.length === 0
  return (
    <>
      <ScreenHeader
        title={t('bookings.mine.title')}
        description={t('bookings.mine.lead')}
        backTo="/profile"
      />
      {empty && <p className="px-safe text-sm text-muted-foreground">{t('bookings.mine.empty')}</p>}
      {data && data.entries.length > 0 && (
        <Section title={t('bookings.mine.entries')}>
          <div className="space-y-3">
            {data.entries.map((entry) => (
              <GlassCard key={entry.id} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {entry.placeName} · {entry.title}
                  </p>
                  <Badge tone={entry.status === 'confirmed' ? 'verified' : 'neutral'}>
                    {t(`bookings.guestStatus.${entry.status}`)}
                  </Badge>
                </div>
                {entry.status === 'confirmed' && entry.code && (
                  <div className="flex flex-col items-center gap-2">
                    <QrCode
                      value={guestQrPayload(entry.code)}
                      label={t('bookings.mine.qrLabel', { place: entry.placeName })}
                      className="size-56"
                    />
                    <p className="font-mono text-lg tracking-wider">
                      {t('bookings.mine.code', { code: formatGuestCode(entry.code) })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t('bookings.mine.showAtDoor', { time: format.time(entry.validUntil) })}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={leave.isPending}
                      onClick={() => leave.mutate(entry.id)}
                    >
                      {t('bookings.mine.leave')}
                    </Button>
                  </div>
                )}
                {entry.status === 'checked_in' && (
                  <p className="text-sm text-muted-foreground">{t('bookings.mine.used')}</p>
                )}
              </GlassCard>
            ))}
          </div>
        </Section>
      )}
      {data && data.reservations.length > 0 && (
        <Section title={t('bookings.mine.reservations')}>
          <div className="space-y-3">
            {data.reservations.map((r) => (
              <GlassCard key={r.id} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {r.placeName} · {format.dateTime(r.arriveAt)}
                  </p>
                  <Badge tone={r.status === 'accepted' ? 'verified' : 'neutral'}>
                    {t(`bookings.status.${r.status}`)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('bookings.mine.party', {
                    count: r.party,
                    kind: t(`bookings.kinds.${r.kind}`),
                  })}
                </p>
                {r.reason && (
                  <p className="text-sm">{t('bookings.mine.reason', { reason: r.reason })}</p>
                )}
                {isActiveReservation(r) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate(r.id)}
                  >
                    {t('bookings.mine.cancel')}
                  </Button>
                )}
              </GlassCard>
            ))}
          </div>
        </Section>
      )}
    </>
  )
}
