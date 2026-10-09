import { Check, QrCode as QrIcon, ScanLine, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '@/platform'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { CheckboxField } from '@/shared/ui/checkbox'
import { TextField } from '@/shared/ui/text-field'
import {
  useCheckInGuest,
  useCloseGuestlist,
  useDecideReservation,
  useSaveBookingSettings,
  useSaveGuestlist,
  useVenueGuestlist,
  useVenueReservations,
} from '../hooks/use-bookings'
import {
  GUESTLIST_MAX_CAPACITY,
  REJECT_REASON_MAX,
  nightEnd,
  normalizeGuestCode,
  type BookingSettings,
  type Reservation,
} from '../model/bookings'
import { useBookingFormat } from './PlaceBookingSection'

function SettingsForm({ placeId, initial }: { placeId: string; initial: BookingSettings }) {
  const { t } = useTranslation()
  const save = useSaveBookingSettings(placeId)
  const [reservations, setReservations] = useState(initial.reservations)
  const [guestlists, setGuestlists] = useState(initial.guestlists)
  const [maxParty, setMaxParty] = useState(String(initial.maxParty))
  const party = Number(maxParty)
  const valid = Number.isInteger(party) && party >= 2 && party <= 20
  return (
    <GlassCard className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('bookings.venue.settingsBody')}</p>
      <CheckboxField checked={reservations} onCheckedChange={setReservations}>
        {t('bookings.venue.acceptReservations')}
      </CheckboxField>
      <CheckboxField checked={guestlists} onCheckedChange={setGuestlists}>
        {t('bookings.venue.acceptGuestlists')}
      </CheckboxField>
      <TextField
        type="number"
        inputMode="numeric"
        min={2}
        max={20}
        label={t('bookings.venue.maxParty')}
        value={maxParty}
        onChange={(event) => setMaxParty(event.target.value)}
      />
      <Button
        block
        disabled={!valid || save.isPending}
        onClick={() => save.mutate({ reservations, guestlists, maxParty: party })}
      >
        {t('bookings.venue.save')}
      </Button>
      {save.isSuccess && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('bookings.venue.saved')}
        </p>
      )}
    </GlassCard>
  )
}

export function BookingSettingsCard({ placeId }: { placeId: string }) {
  const { data } = useVenueReservations(placeId, true)
  if (!data) return null
  return <SettingsForm placeId={placeId} initial={data.settings} />
}

function RequestRow({ placeId, reservation }: { placeId: string; reservation: Reservation }) {
  const { t } = useTranslation()
  const decide = useDecideReservation(placeId)
  const format = useBookingFormat()
  const [reason, setReason] = useState('')
  return (
    <li className="space-y-2 border-b border-border pb-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">
          {t('bookings.venue.requestRow', {
            name: reservation.name ?? '—',
            party: reservation.party,
            kind: t(`bookings.kinds.${reservation.kind}`),
          })}
        </p>
        <Badge tone={reservation.status === 'accepted' ? 'verified' : 'neutral'}>
          {t(`bookings.status.${reservation.status}`)}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{format.dateTime(reservation.arriveAt)}</p>
      {reservation.status === 'requested' && (
        <>
          <TextField
            label={t('bookings.venue.reasonLabel')}
            maxLength={REJECT_REASON_MAX}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: reservation.id, accept: true })}
            >
              <Check aria-hidden />
              {t('bookings.venue.accept')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={decide.isPending}
              onClick={() =>
                decide.mutate({ id: reservation.id, accept: false, reason: reason.trim() })
              }
            >
              <X aria-hidden />
              {t('bookings.venue.reject')}
            </Button>
          </div>
        </>
      )}
    </li>
  )
}

export function ReservationRequestsCard({ placeId }: { placeId: string }) {
  const { t } = useTranslation()
  const { data } = useVenueReservations(placeId, true)
  if (!data?.settings.reservations && !data?.items.length) return null
  return (
    <GlassCard className="space-y-3">
      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('bookings.venue.noRequests')}</p>
      ) : (
        <ul className="space-y-3">
          {data.items.map((r) => (
            <RequestRow key={r.id} placeId={placeId} reservation={r} />
          ))}
        </ul>
      )}
    </GlassCard>
  )
}

/** "HH:MM" today, or tomorrow if that time has already passed (nights cross midnight). */
function nextTime(time: string, now = new Date()): Date | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match) return null
  const at = new Date(now)
  at.setHours(Number(match[1]), Number(match[2]), 0, 0)
  if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1)
  return at
}

function DoorCheck({ placeId }: { placeId: string }) {
  const { t } = useTranslation()
  const { camera } = usePlatform()
  const check = useCheckInGuest(placeId)
  const format = useBookingFormat()
  const [code, setCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [cameraError, setCameraError] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const submit = (raw: string) => {
    const normalized = normalizeGuestCode(raw)
    if (normalized) check.mutate(normalized)
    else check.reset()
  }
  useEffect(() => {
    if (!scanning) return
    let stop: (() => void) | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    void camera.openLiveStream('environment').then((opened) => {
      if (cancelled) return opened.ok && opened.value.stop()
      if (!opened.ok || !video.current) {
        setCameraError(true)
        setScanning(false)
        return
      }
      const live = opened.value
      stop = () => live.stop()
      video.current.srcObject = opened.value.stream
      void video.current.play()
      const tick = async () => {
        if (cancelled || !video.current) return
        const value = await camera.detectQr(video.current)
        const normalized = value ? normalizeGuestCode(value) : null
        if (normalized) {
          setScanning(false)
          check.mutate(normalized)
          return
        }
        timer = setTimeout(() => void tick(), 400)
      }
      void tick()
    })
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      stop?.()
    }
    // `check.mutate` is stable; restarting only depends on `scanning`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, camera])
  const result = check.data
  return (
    <div className="space-y-3 rounded-theme border border-border p-3">
      <p className="flex items-center gap-2 font-medium">
        <ScanLine className="size-4 text-primary" aria-hidden />
        {t('bookings.venue.doorTitle')}
      </p>
      {camera.canDetectQr() ? (
        <Button size="sm" variant="secondary" onClick={() => setScanning((v) => !v)}>
          <QrIcon aria-hidden />
          {scanning ? t('bookings.venue.stopScan') : t('bookings.venue.scan')}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">{t('bookings.venue.scanUnsupported')}</p>
      )}
      {scanning && (
        <video
          ref={video}
          muted
          playsInline
          className="aspect-square w-full rounded-theme bg-black"
        />
      )}
      {cameraError && (
        <p className="text-xs text-muted-foreground">{t('bookings.venue.cameraError')}</p>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          submit(code)
        }}
      >
        <TextField
          label={t('bookings.venue.codeLabel')}
          autoCapitalize="characters"
          autoComplete="off"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={check.isPending || !normalizeGuestCode(code)}>
          {t('bookings.venue.check')}
        </Button>
      </form>
      {result && (
        <p role="status" className={result.result === 'ok' ? 'text-success' : 'text-warning'}>
          {result.result === 'ok'
            ? t('bookings.venue.ok', { name: result.name })
            : t('bookings.venue.alreadyUsed', {
                name: result.name,
                time: result.checkedInAt ? format.time(result.checkedInAt) : '—',
              })}
        </p>
      )}
      {check.isError && (
        <p role="alert" className="text-sm text-danger">
          {t('bookings.venue.invalidCode')}
        </p>
      )}
    </div>
  )
}

export function GuestlistCard({ placeId }: { placeId: string }) {
  const { t } = useTranslation()
  const { data } = useVenueGuestlist(placeId, true)
  const save = useSaveGuestlist(placeId)
  const close = useCloseGuestlist(placeId)
  const format = useBookingFormat()
  const list = data?.list ?? null
  const [title, setTitle] = useState('')
  const [until, setUntil] = useState('01:30')
  const [capacity, setCapacity] = useState('50')
  const [invalid, setInvalid] = useState(false)
  if (!data) return null
  if (!data.settings.guestlists && !list)
    return (
      <GlassCard>
        <p className="text-sm text-muted-foreground">{t('bookings.venue.enableFirst')}</p>
      </GlassCard>
    )
  const submit = () => {
    const at = nextTime(until)
    const places = Number(capacity)
    if (
      !at ||
      at.getTime() > nightEnd().getTime() ||
      !Number.isInteger(places) ||
      places < 1 ||
      places > GUESTLIST_MAX_CAPACITY
    )
      return setInvalid(true)
    setInvalid(false)
    save.mutate({
      title: title.trim() || list?.title || '',
      validUntil: at.toISOString(),
      capacity: places,
    })
  }
  const taken = list?.entries.length ?? 0
  const used = list?.entries.filter((e) => e.status === 'checked_in').length ?? 0
  return (
    <GlassCard className="space-y-4">
      {list && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{list.title}</p>
            {list.status === 'closed' && <Badge>{t('bookings.venue.closed')}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {t('bookings.place.guestlistUntil', { time: format.time(list.validUntil) })} ·{' '}
            {t('bookings.venue.counts', { taken, capacity: list.capacity, used })}
          </p>
          <ul className="space-y-1 text-sm">
            {list.entries.map((e) => (
              <li key={e.id} className="flex justify-between gap-2">
                <span>{e.name}</span>
                <span className="text-muted-foreground">
                  {t(`bookings.guestStatus.${e.status}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="space-y-3">
        <TextField
          label={t('bookings.venue.listName')}
          hint={t('bookings.venue.listNameHint')}
          maxLength={60}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            type="time"
            label={t('bookings.venue.listUntil')}
            value={until}
            onChange={(event) => setUntil(event.target.value)}
          />
          <TextField
            type="number"
            inputMode="numeric"
            min={1}
            max={GUESTLIST_MAX_CAPACITY}
            label={t('bookings.venue.capacity')}
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
          />
        </div>
        {invalid && (
          <p role="alert" className="text-sm text-danger">
            {t('bookings.venue.invalidTime')}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button disabled={save.isPending || (!list && title.trim().length < 3)} onClick={submit}>
            {list ? t('bookings.venue.updateList') : t('bookings.venue.createList')}
          </Button>
          {list?.status === 'open' && (
            <Button variant="ghost" disabled={close.isPending} onClick={() => close.mutate()}>
              {t('bookings.venue.closeList')}
            </Button>
          )}
        </div>
      </div>
      {list && <DoorCheck placeId={placeId} />}
    </GlassCard>
  )
}
