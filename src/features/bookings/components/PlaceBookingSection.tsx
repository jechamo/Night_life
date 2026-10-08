import { CalendarCheck, ListChecks } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/shared/ui/badge'
import { Button, ButtonLink } from '@/shared/ui/button'
import { SingleChoice } from '@/shared/ui/choice-group'
import { TextField } from '@/shared/ui/text-field'
import {
  useBookingOptions,
  useJoinGuestlist,
  useLeaveGuestlist,
  useRequestReservation,
} from '../hooks/use-bookings'
import { RESERVATION_KINDS, type ReservationError, type ReservationKind } from '../model/bookings'

type ErrorKey = ReservationError | 'list_full'
const ERRORS: readonly ErrorKey[] = [
  'not_available',
  'own_venue',
  'booking_limit',
  'already_booked',
  'age_required',
  'invalid',
  'list_full',
]
const errorKey = (message: string | undefined): ErrorKey | 'generic' =>
  ERRORS.find((code) => code === message) ?? 'generic'

export function useBookingFormat() {
  const { i18n } = useTranslation()
  const date = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  const time = new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' })
  return {
    dateTime: (iso: string) => date.format(new Date(iso)),
    time: (iso: string) => time.format(new Date(iso)),
  }
}

/** Night day + arrival time; times before 06:00 belong to the early hours of the next day. */
export function arrivalFrom(day: string, time: string): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  const t = /^(\d{2}):(\d{2})$/.exec(time)
  if (!d || !t || Number(t[1]) > 23 || Number(t[2]) > 59) return null
  const at = new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]))
  if (Number(t[1]) < 6) at.setDate(at.getDate() + 1)
  return at.toISOString()
}

const localDay = (date = new Date()) => {
  const shifted = new Date(date.getTime() - 6 * 3_600_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}`
}

function ReservationForm({ placeId, maxParty }: { placeId: string; maxParty: number }) {
  const { t } = useTranslation()
  const request = useRequestReservation(placeId)
  const [day, setDay] = useState(localDay())
  const [time, setTime] = useState('23:30')
  const [party, setParty] = useState('2')
  const [kind, setKind] = useState<ReservationKind>('table')
  const error = request.error?.message
  const submit = () => {
    const arriveAt = arrivalFrom(day, time)
    if (arriveAt) request.mutate({ arriveAt, party: Number(party), kind })
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <TextField
          type="date"
          label={t('bookings.place.date')}
          value={day}
          min={localDay()}
          onChange={(event) => setDay(event.target.value)}
        />
        <TextField
          type="time"
          label={t('bookings.place.time')}
          value={time}
          onChange={(event) => setTime(event.target.value)}
        />
      </div>
      <TextField
        type="number"
        inputMode="numeric"
        label={t('bookings.place.party')}
        min={1}
        max={maxParty}
        value={party}
        onChange={(event) => setParty(event.target.value)}
      />
      <SingleChoice<ReservationKind>
        label={t('bookings.place.kind')}
        value={kind}
        onChange={setKind}
        options={RESERVATION_KINDS.map((value) => ({ value, label: t(`bookings.kinds.${value}`) }))}
      />
      <Button block disabled={request.isPending} onClick={submit}>
        <CalendarCheck aria-hidden />
        {t('bookings.place.submit')}
      </Button>
      {request.isSuccess && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('bookings.place.sent')}
        </p>
      )}
      {request.isError && (
        <p role="alert" className="text-sm text-danger">
          {t(`bookings.errors.${errorKey(error)}`)}
        </p>
      )}
    </div>
  )
}

/**
 * Roadmap R5: table requests (no payment) and tonight's guest list, only when the venue
 * offers them. Acting needs a verified age; the venue only sees the profile name.
 */
export function PlaceBookingSection({ placeId }: { placeId: string }) {
  const { t } = useTranslation()
  const { data } = useBookingOptions(placeId, true)
  const join = useJoinGuestlist(placeId)
  const leave = useLeaveGuestlist()
  const format = useBookingFormat()
  if (!data) return null
  const list = data.guestlist
  if (!data.reservations && !list && data.myReservations.length === 0) return null
  const joinError = join.error?.message
  return (
    <section aria-labelledby={`bookings-${placeId}`} className="space-y-4">
      <div>
        <h3 id={`bookings-${placeId}`} className="font-display text-lg font-semibold">
          {t('bookings.place.title')}
        </h3>
        <p className="text-xs text-muted-foreground">{t('bookings.place.hint')}</p>
      </div>
      {data.myReservations.map((r) => (
        <p key={r.id} className="text-sm">
          {t('bookings.place.myReservation', {
            date: format.dateTime(r.arriveAt),
            party: r.party,
            status: t(`bookings.status.${r.status}`),
          })}
        </p>
      ))}
      {data.ownVenue ? (
        <p className="text-sm text-muted-foreground">{t('bookings.place.ownVenue')}</p>
      ) : !data.ageVerified ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t('bookings.place.ageRequired')}</p>
          <ButtonLink to="/verification/age" variant="secondary" size="sm">
            {t('bookings.place.verify')}
          </ButtonLink>
        </div>
      ) : (
        <>
          {list && (
            <div className="space-y-2 rounded-theme border border-border p-3">
              <p className="flex items-center gap-2 font-medium">
                <ListChecks className="size-4 text-primary" aria-hidden />
                {t('bookings.place.guestlistTitle')}: {list.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('bookings.place.guestlistUntil', { time: format.time(list.validUntil) })}
              </p>
              {data.myEntry && data.myEntry.status !== 'cancelled' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="verified">{t('bookings.place.joined')}</Badge>
                  <ButtonLink to="/reservas" variant="ghost" size="sm">
                    {t('bookings.place.seeMine')}
                  </ButtonLink>
                  {data.myEntry.status === 'confirmed' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={leave.isPending}
                      onClick={() => data.myEntry && leave.mutate(data.myEntry.id)}
                    >
                      {t('bookings.mine.leave')}
                    </Button>
                  )}
                </div>
              ) : list.full ? (
                <p className="text-sm text-muted-foreground">{t('bookings.place.full')}</p>
              ) : (
                <Button size="sm" disabled={join.isPending} onClick={() => join.mutate(list.id)}>
                  {t('bookings.place.join')}
                </Button>
              )}
              {join.isError && (
                <p role="alert" className="text-sm text-danger">
                  {t(`bookings.errors.${errorKey(joinError)}`)}
                </p>
              )}
            </div>
          )}
          {data.reservations && (
            <div className="space-y-2">
              <p className="font-medium">{t('bookings.place.reserveTitle')}</p>
              <ReservationForm placeId={placeId} maxParty={data.maxParty} />
            </div>
          )}
        </>
      )}
    </section>
  )
}
