import { ImagePlus, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NoticeBadges } from '@/features/places/components/ShowcaseSection'
import { useVenueShowcase } from '@/features/places/hooks/use-showcase'
import {
  change,
  DOOR_STATES,
  DRESS_CODES,
  EMPTY_EXTRAS,
  formatEuros,
  MAX_DRINK_CENTS,
  MAX_ENTRY_CENTS,
  OFFER_KINDS,
  OFFER_MAX_HOURS,
  parseEuros,
  REPORT_THRESHOLD,
  usedPhotoSlots,
  type DoorState,
  type DressCode,
  type OfferKind,
  type ReportPeriod,
  type VenueExtras,
} from '@/features/places/model/showcase'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { CheckboxField } from '@/shared/ui/checkbox'
import { SingleChoice } from '@/shared/ui/choice-group'
import { TextField } from '@/shared/ui/text-field'
import {
  useRemoveVenuePhoto,
  useSaveVenueExtras,
  useSetCoverPhoto,
  useSetVenueNotice,
  useUploadVenuePhoto,
  useVenuePhotos,
  useVenueReport,
  type UploadError,
} from '../hooks/use-showcase-panel'

const UPLOAD_ERRORS: readonly UploadError[] = [
  'photo_limit',
  'unsupported_type',
  'too_large',
  'decode_failed',
]

export function PhotosCard({ placeId }: { placeId: string }) {
  const { t } = useTranslation()
  const { data } = useVenuePhotos(placeId, true)
  const upload = useUploadVenuePhoto(placeId)
  const remove = useRemoveVenuePhoto(placeId)
  const cover = useSetCoverPhoto(placeId)
  if (!data) return null
  const used = usedPhotoSlots(data.photos)
  const uploadError = upload.error?.message
  const errorKey = UPLOAD_ERRORS.find((code) => code === uploadError) ?? 'generic'
  // Without an explicit cover, the first visible photo is the cover (as on the server).
  const coverId =
    data.photos.find((p) => p.isCover && p.visible)?.id ?? data.photos.find((p) => p.visible)?.id
  return (
    <GlassCard className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('venuePanel.showcase.photos.body')}</p>
      <p className="font-label text-sm">
        {t('venuePanel.showcase.photos.limit', { used, limit: data.limit })}
      </p>
      {!data.plan && (
        <p className="text-xs text-muted-foreground">{t('venuePanel.showcase.photos.planHint')}</p>
      )}
      {data.photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('venuePanel.showcase.photos.empty')}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {data.photos.map((photo) => {
            const status = t(`venuePanel.showcase.photos.status.${photo.status}`)
            return (
              <li key={photo.id} className="space-y-2">
                <div className="aspect-[4/3] overflow-hidden rounded-theme bg-surface-raised">
                  <img
                    src={photo.url}
                    alt={t('venuePanel.showcase.photos.alt', { status })}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge tone={photo.status === 'approved' ? 'verified' : 'neutral'}>
                    {status}
                  </Badge>
                  {photo.id === coverId && (
                    <Badge tone="hereNow">{t('venuePanel.showcase.photos.cover')}</Badge>
                  )}
                </div>
                {photo.status === 'rejected' && photo.reason && (
                  <p className="text-xs text-muted-foreground">
                    {t('venuePanel.showcase.photos.reason', { reason: photo.reason })}
                  </p>
                )}
                {photo.status === 'approved' && !photo.visible && (
                  <p className="text-xs text-muted-foreground">
                    {t('venuePanel.showcase.photos.hidden')}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {photo.status === 'approved' && photo.visible && photo.id !== coverId && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={cover.isPending}
                      onClick={() => cover.mutate(photo.id)}
                    >
                      <Star aria-hidden />
                      {t('venuePanel.showcase.photos.makeCover')}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(photo.id)}
                  >
                    <Trash2 aria-hidden />
                    {t('venuePanel.showcase.photos.remove')}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <Button
        block
        disabled={upload.isPending || used >= data.limit}
        onClick={() => upload.mutate()}
      >
        <ImagePlus aria-hidden />
        {t('venuePanel.showcase.photos.add')}
      </Button>
      {upload.isError && (
        <p role="alert" className="text-sm text-danger">
          {t(`venuePanel.showcase.photos.errors.${errorKey}`)}
        </p>
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

function OfferRow({ placeId, kind }: { placeId: string; kind: OfferKind }) {
  const { t } = useTranslation()
  const set = useSetVenueNotice(placeId)
  const [time, setTime] = useState('')
  const [invalid, setInvalid] = useState(false)
  const label =
    kind === 'free_entry'
      ? t('venuePanel.showcase.live.freeEntry')
      : t('venuePanel.showcase.live.happyHour')
  const publish = () => {
    const at = nextTime(time)
    if (!at || at.getTime() > Date.now() + OFFER_MAX_HOURS * 3_600_000) return setInvalid(true)
    setInvalid(false)
    set.mutate({ kind, until: at.toISOString() })
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      <TextField
        type="time"
        label={label}
        value={time}
        onChange={(event) => setTime(event.target.value)}
        className="w-36"
      />
      <Button size="sm" disabled={!time || set.isPending} onClick={publish}>
        {t('venuePanel.showcase.live.publish')}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={set.isPending}
        onClick={() => set.mutate({ clear: kind })}
      >
        {t('venuePanel.showcase.live.clear')}
      </Button>
      {invalid && (
        <p role="alert" className="w-full text-sm text-danger">
          {t('venuePanel.showcase.live.invalidTime')}
        </p>
      )}
    </div>
  )
}

export function LiveNoticeCard({ placeId }: { placeId: string }) {
  const { t } = useTranslation()
  const { data } = useVenueShowcase(placeId, true)
  const set = useSetVenueNotice(placeId)
  const door = data?.notices.find((n) => n.kind === 'door')
  return (
    <GlassCard className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('venuePanel.showcase.live.body')}</p>
      {data && data.notices.length > 0 && <NoticeBadges notices={data.notices} />}
      <SingleChoice<DoorState>
        label={t('venuePanel.showcase.live.door')}
        value={door?.kind === 'door' ? door.value : undefined}
        onChange={(value) => set.mutate({ kind: 'door', value })}
        options={DOOR_STATES.map((value) => ({
          value,
          label: t(`places.showcase.door.${value}`),
        }))}
      />
      {door && (
        <Button
          size="sm"
          variant="ghost"
          disabled={set.isPending}
          onClick={() => set.mutate({ clear: 'door' })}
        >
          {t('venuePanel.showcase.live.clear')}
        </Button>
      )}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">{t('venuePanel.showcase.live.offers')}</legend>
        {OFFER_KINDS.map((kind) => (
          <OfferRow key={kind} placeId={placeId} kind={kind} />
        ))}
      </fieldset>
    </GlassCard>
  )
}

const euros = (cents: number | null) => (cents === null ? '' : formatEuros(cents))
const MIN_AGES = ['18', '21', '23', '25'] as const

function ExtrasForm({ placeId, initial }: { placeId: string; initial: VenueExtras }) {
  const { t } = useTranslation()
  const save = useSaveVenueExtras(placeId)
  const [dressCode, setDressCode] = useState<DressCode | 'unset'>(initial.dressCode ?? 'unset')
  const [minAge, setMinAge] = useState<string>(
    initial.minAge === null ? 'unset' : String(initial.minAge),
  )
  const [entry, setEntry] = useState(euros(initial.entryPriceCents))
  const [drink, setDrink] = useState(euros(initial.drinkPriceCents))
  const [terrace, setTerrace] = useState(initial.terrace === true)
  const [accessible, setAccessible] = useState(initial.accessible === true)
  const entryCents = parseEuros(entry, MAX_ENTRY_CENTS)
  const drinkCents = parseEuros(drink, MAX_DRINK_CENTS)
  const invalid = entryCents === 'invalid' || drinkCents === 'invalid'
  const submit = () => {
    if (entryCents === 'invalid' || drinkCents === 'invalid') return
    save.mutate({
      dressCode: dressCode === 'unset' ? null : dressCode,
      minAge: minAge === 'unset' ? null : Number(minAge),
      entryPriceCents: entryCents,
      drinkPriceCents: drinkCents,
      terrace: terrace ? true : null,
      accessible: accessible ? true : null,
    })
  }
  const ageOptions = [
    { value: 'unset', label: t('venuePanel.showcase.extras.unset') },
    ...MIN_AGES.map((age) => ({ value: age, label: `${age}+` })),
  ]
  return (
    <GlassCard className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('venuePanel.showcase.extras.body')}</p>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('venuePanel.showcase.extras.dressCode')}</legend>
        <SingleChoice<DressCode | 'unset'>
          label={t('venuePanel.showcase.extras.dressCode')}
          value={dressCode}
          onChange={setDressCode}
          options={[
            { value: 'unset', label: t('venuePanel.showcase.extras.unset') },
            ...DRESS_CODES.map((code) => ({
              value: code,
              label: t(`places.showcase.dress.${code}`),
            })),
          ]}
        />
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('venuePanel.showcase.extras.minAge')}</legend>
        <SingleChoice
          label={t('venuePanel.showcase.extras.minAge')}
          value={minAge}
          onChange={setMinAge}
          options={ageOptions}
        />
      </fieldset>
      <TextField
        label={t('venuePanel.showcase.extras.entry')}
        hint={t('venuePanel.showcase.extras.entryHint')}
        inputMode="decimal"
        value={entry}
        onChange={(event) => setEntry(event.target.value)}
      />
      <TextField
        label={t('venuePanel.showcase.extras.drink')}
        inputMode="decimal"
        value={drink}
        onChange={(event) => setDrink(event.target.value)}
      />
      <CheckboxField checked={terrace} onCheckedChange={setTerrace}>
        {t('venuePanel.showcase.extras.terrace')}
      </CheckboxField>
      <CheckboxField checked={accessible} onCheckedChange={setAccessible}>
        {t('venuePanel.showcase.extras.accessible')}
      </CheckboxField>
      {invalid && (
        <p role="alert" className="text-sm text-danger">
          {t('venuePanel.showcase.extras.invalidPrice')}
        </p>
      )}
      <Button block disabled={invalid || save.isPending} onClick={submit}>
        {t('venuePanel.showcase.extras.save')}
      </Button>
      {save.isSuccess && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('venuePanel.showcase.extras.saved')}
        </p>
      )}
    </GlassCard>
  )
}

export function ExtrasCard({ placeId }: { placeId: string }) {
  const { data } = useVenueShowcase(placeId, true)
  if (!data) return null
  return <ExtrasForm placeId={placeId} initial={data.details ?? EMPTY_EXTRAS} />
}

function useFigure() {
  const { t, i18n } = useTranslation()
  const number = new Intl.NumberFormat(i18n.language)
  return (n: number) =>
    n < REPORT_THRESHOLD ? t('venuePanel.showcase.report.lessThan') : number.format(n)
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-theme bg-surface-raised p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-xl font-semibold">{value}</dd>
    </div>
  )
}

function PeriodFigures({ period }: { period: ReportPeriod }) {
  const { t } = useTranslation()
  const figure = useFigure()
  return (
    <dl className="grid grid-cols-2 gap-2">
      <Figure label={t('venuePanel.showcase.report.views')} value={figure(period.views)} />
      <Figure label={t('venuePanel.showcase.report.going')} value={figure(period.going)} />
      <Figure label={t('venuePanel.showcase.report.checkIns')} value={figure(period.checkIns)} />
      <Figure
        label={t('venuePanel.showcase.report.conversion')}
        value={
          period.conversion === null
            ? t('venuePanel.showcase.report.lessThan')
            : `${period.conversion} %`
        }
      />
    </dl>
  )
}

export function ReportCard({ placeId }: { placeId: string }) {
  const { t, i18n } = useTranslation()
  const { data } = useVenueReport(placeId, true)
  const figure = useFigure()
  if (!data) return null
  const date = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' })
  const day = (iso: string) => date.format(new Date(iso))
  return (
    <GlassCard className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('venuePanel.showcase.report.body')}</p>
      <PeriodFigures period={data.summary} />
      <div className="space-y-2">
        <h3 className="font-display font-semibold">
          {t('venuePanel.showcase.report.sponsorships')}
        </h3>
        {data.sponsorships.length === 0 && data.flashes.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('venuePanel.showcase.report.none')}</p>
        )}
        <ul className="space-y-3 text-sm">
          {data.sponsorships.map((s) => {
            const delta = change(s.during.views, s.before.views)
            return (
              <li key={`${s.tier}-${s.from}`} className="space-y-0.5">
                <p className="font-medium">
                  {t('venuePanel.showcase.report.sponsorshipRow', {
                    tier: t(`venuePanel.sponsor.tiers.${s.tier}.name`),
                    from: day(s.from),
                    to: day(s.to),
                  })}
                </p>
                <p>
                  {t('venuePanel.showcase.report.during', {
                    views: figure(s.during.views),
                    checkIns: figure(s.during.checkIns),
                  })}
                </p>
                <p className="text-muted-foreground">
                  {t('venuePanel.showcase.report.before', {
                    views: figure(s.before.views),
                    checkIns: figure(s.before.checkIns),
                  })}
                </p>
                {delta !== null && (
                  <p>
                    {t('venuePanel.showcase.report.change', {
                      value: delta > 0 ? `+${delta}` : delta,
                    })}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
        {data.flashes.length > 0 && (
          <>
            <h3 className="font-display font-semibold">
              {t('venuePanel.showcase.report.flashes')}
            </h3>
            <ul className="space-y-2 text-sm">
              {data.flashes.map((f) => (
                <li key={f.startsAt}>
                  <p className="font-medium">
                    {t('venuePanel.showcase.report.flashRow', {
                      title: f.title,
                      date: day(f.startsAt),
                    })}
                  </p>
                  <p className="text-muted-foreground">
                    {t('venuePanel.showcase.report.flashResult', {
                      now: figure(f.checkIns),
                      before: figure(f.weekBefore),
                    })}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {data.pro && data.daily ? (
        <div className="space-y-2">
          <h3 className="font-display font-semibold">{t('venuePanel.showcase.report.proTitle')}</h3>
          {data.previous && (
            <p className="text-sm text-muted-foreground">
              {t('venuePanel.showcase.report.previous', {
                views: figure(data.previous.views),
                checkIns: figure(data.previous.checkIns),
              })}
            </p>
          )}
          <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {data.daily
              .filter((d) => d.views > 0 || d.checkIns > 0)
              .map((d) => (
                <li key={d.night}>
                  {t('venuePanel.showcase.report.night', {
                    date: day(d.night),
                    views: figure(d.views),
                    checkIns: figure(d.checkIns),
                  })}
                </li>
              ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('venuePanel.showcase.report.proUpsell')}</p>
      )}
    </GlassCard>
  )
}
