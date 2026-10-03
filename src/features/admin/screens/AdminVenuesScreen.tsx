import { MapPin, Plus, Trash2 } from 'lucide-react'
import { useState, type ChangeEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CITIES } from '@/features/places/model/cities'
import { VENUE_TYPES, type VenueType } from '@/shared/domain/venue-types'
import { FeatureGate } from '@/shared/flags/FeatureGate'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { SingleChoice } from '@/shared/ui/choice-group'
import { EmptyState } from '@/shared/ui/empty-state'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Section } from '@/shared/ui/section'
import { TextAreaField, TextField } from '@/shared/ui/text-field'
import {
  useAdminVenues,
  useFillTestVenue,
  useImportTestEvents,
  useSaveVenue,
  useSeedTestVenues,
} from '../hooks/use-admin'
import { venueInputErrors, type AdminVenue, type VenueField, type VenueInput } from '../model/venue'

const PRICES = ['1', '2', '3', '4'] as const
const DAYS = [0, 1, 2, 3, 4, 5, 6] as const

interface Draft extends Omit<VenueInput, 'lat' | 'lng' | 'minAge' | 'music'> {
  lat: string
  lng: string
  minAge: string
  music: string
}

const EMPTY: Draft = {
  name: '',
  type: 'bar',
  city: CITIES[0].name,
  address: '',
  description: '',
  hours: '',
  price: 2,
  phone: '',
  website: '',
  music: '',
  dressCode: '',
  minAge: '',
  notes: '',
  openingHours: [],
  lat: '',
  lng: '',
}

function toDraft(v: AdminVenue): Draft {
  return {
    ...v,
    music: v.music.join(', '),
    minAge: v.minAge === null ? '' : String(v.minAge),
    lat: v.lat === null ? '' : String(v.lat),
    lng: v.lng === null ? '' : String(v.lng),
  }
}

function toInput(d: Draft): VenueInput {
  return {
    ...d,
    lat: d.lat.trim() === '' ? Number.NaN : Number(d.lat),
    lng: d.lng.trim() === '' ? Number.NaN : Number(d.lng),
    minAge: d.minAge.trim() === '' ? null : Number(d.minAge),
    music: d.music
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean)
      .slice(0, 8),
  }
}

function ChoiceField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium" aria-hidden>
        {label}
      </p>
      {children}
    </div>
  )
}

function weekdayName(day: number, language: string) {
  return new Intl.DateTimeFormat(language, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2024, 0, 1 + day)),
  )
}

function VenueForm({
  id,
  initial,
  onDone,
}: {
  id: string | null
  initial: Draft
  onDone: () => void
}) {
  const { t, i18n } = useTranslation()
  const save = useSaveVenue()
  const [draft, setDraft] = useState(initial)
  const [submitted, setSubmitted] = useState(false)
  const input = toInput(draft)
  const errors = new Set(venueInputErrors(input))
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))
  const err = (key: VenueField): { error?: string } =>
    submitted && errors.has(key) ? { error: t(`admin.venues.errors.${key}`) } : {}
  const field = (key: 'name' | 'address' | 'phone' | 'website' | 'dressCode' | 'hours') => ({
    label: t(`admin.venues.fields.${key}`),
    value: draft[key],
    onChange: (e: ChangeEvent<HTMLInputElement>) => set(key, e.target.value),
    ...(key === 'dressCode' || key === 'hours' ? {} : err(key)),
  })

  return (
    <GlassCard className="space-y-4">
      <h3 className="text-lg font-semibold">
        {t(id ? 'admin.venues.editTitle' : 'admin.venues.newTitle')}
      </h3>
      <TextField {...field('name')} maxLength={80} />
      <ChoiceField label={t('admin.venues.fields.type')}>
        <SingleChoice<VenueType>
          label={t('admin.venues.fields.type')}
          value={draft.type}
          options={VENUE_TYPES.map((v) => ({ value: v, label: t(`venueTypes.${v}`) }))}
          onChange={(v) => set('type', v)}
        />
      </ChoiceField>
      <ChoiceField label={t('admin.venues.fields.city')}>
        <SingleChoice
          label={t('admin.venues.fields.city')}
          value={draft.city}
          options={CITIES.map((c) => ({ value: c.name, label: c.name }))}
          onChange={(v) => set('city', v)}
        />
      </ChoiceField>
      <TextField {...field('address')} maxLength={160} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          type="number"
          step="any"
          label={t('admin.venues.fields.lat')}
          value={draft.lat}
          onChange={(e) => set('lat', e.target.value)}
          {...err('lat')}
        />
        <TextField
          type="number"
          step="any"
          label={t('admin.venues.fields.lng')}
          value={draft.lng}
          onChange={(e) => set('lng', e.target.value)}
          {...err('lng')}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t('admin.venues.fields.coordsHint')}</p>
      <ChoiceField label={t('admin.venues.fields.price')}>
        <SingleChoice
          label={t('admin.venues.fields.price')}
          value={String(draft.price) as (typeof PRICES)[number]}
          options={PRICES.map((p) => ({ value: p, label: '€'.repeat(Number(p)) }))}
          onChange={(p) => set('price', Number(p) as Draft['price'])}
        />
      </ChoiceField>
      <TextField {...field('hours')} maxLength={60} hint={t('admin.venues.fields.hoursHint')} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('admin.venues.fields.openingHours')}</legend>
        {draft.openingHours.map((period, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              {t('admin.venues.fields.day')}
              <select
                value={period.day}
                onChange={(e) =>
                  set(
                    'openingHours',
                    draft.openingHours.map((p, i) =>
                      i === index ? { ...p, day: Number(e.target.value) } : p,
                    ),
                  )
                }
                className="h-11 rounded-theme border border-border bg-surface px-3"
              >
                {DAYS.map((day) => (
                  <option key={day} value={day}>
                    {weekdayName(day, i18n.language)}
                  </option>
                ))}
              </select>
            </label>
            {(['opens', 'closes'] as const).map((key) => (
              <TextField
                key={key}
                type="time"
                className="w-36"
                label={t(`admin.venues.fields.${key}`)}
                value={period[key]}
                onChange={(e) =>
                  set(
                    'openingHours',
                    draft.openingHours.map((p, i) =>
                      i === index ? { ...p, [key]: e.target.value } : p,
                    ),
                  )
                }
              />
            ))}
            <Button
              size="sm"
              variant="ghost"
              aria-label={t('admin.venues.fields.removePeriod')}
              onClick={() =>
                set(
                  'openingHours',
                  draft.openingHours.filter((_, i) => i !== index),
                )
              }
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
        {draft.openingHours.length < 14 && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              set('openingHours', [
                ...draft.openingHours,
                { day: 4, opens: '22:00', closes: '05:00' },
              ])
            }
          >
            <Plus aria-hidden />
            {t('admin.venues.fields.addPeriod')}
          </Button>
        )}
        {submitted && errors.has('openingHours') && (
          <p role="alert" className="text-sm text-danger">
            {t('admin.venues.errors.openingHours')}
          </p>
        )}
      </fieldset>
      <TextAreaField
        label={t('admin.venues.fields.description')}
        value={draft.description}
        maxLength={500}
        counter={`${draft.description.length}/500`}
        onChange={(e) => set('description', e.target.value)}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField {...field('phone')} type="tel" maxLength={20} />
        <TextField {...field('website')} type="url" placeholder="https://" maxLength={300} />
      </div>
      <TextField
        label={t('admin.venues.fields.music')}
        hint={t('admin.venues.fields.musicHint')}
        value={draft.music}
        onChange={(e) => set('music', e.target.value)}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField {...field('dressCode')} maxLength={80} />
        <TextField
          type="number"
          min={18}
          max={25}
          label={t('admin.venues.fields.minAge')}
          hint={t('admin.venues.fields.minAgeHint')}
          value={draft.minAge}
          onChange={(e) => set('minAge', e.target.value)}
          {...err('minAge')}
        />
      </div>
      <TextAreaField
        label={t('admin.venues.fields.notes')}
        hint={t('admin.venues.fields.notesHint')}
        value={draft.notes}
        maxLength={500}
        onChange={(e) => set('notes', e.target.value)}
      />
      {save.isError && (
        <p role="alert" className="text-sm text-danger">
          {t('admin.venues.error')}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          disabled={save.isPending}
          onClick={() => {
            setSubmitted(true)
            if (errors.size === 0) save.mutate({ id, input }, { onSuccess: onDone })
          }}
        >
          {t('common.save')}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {t('admin.venues.cancel')}
        </Button>
      </div>
    </GlassCard>
  )
}

function TestCatalogue({ venues }: { venues: readonly AdminVenue[] }) {
  const { t } = useTranslation()
  const seed = useSeedTestVenues()
  const importEvents = useImportTestEvents()
  const [city, setCity] = useState<string>(CITIES[0].name)
  const [result, setResult] = useState<string | null>(null)
  const failed = seed.isError || importEvents.isError
  return (
    <GlassCard className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('admin.venues.fixtures.body')}</p>
      <Button
        size="sm"
        variant="secondary"
        disabled={seed.isPending}
        onClick={() =>
          seed.mutate(undefined, {
            onSuccess: (count) => setResult(t('admin.venues.fixtures.seeded', { count })),
          })
        }
      >
        {t('admin.venues.fixtures.seed')}
      </Button>
      <ChoiceField label={t('admin.venues.fields.city')}>
        <SingleChoice
          label={t('admin.venues.fields.city')}
          value={city}
          options={CITIES.map((c) => ({ value: c.name, label: c.name }))}
          onChange={setCity}
        />
      </ChoiceField>
      <Button
        size="sm"
        variant="secondary"
        disabled={importEvents.isPending || !venues.some((v) => v.isTest && v.city === city)}
        onClick={() =>
          importEvents.mutate(
            { city, count: 3 },
            {
              onSuccess: (count) => setResult(t('admin.venues.fixtures.imported', { count, city })),
            },
          )
        }
      >
        {t('admin.venues.fixtures.import', { city })}
      </Button>
      {result && !failed && (
        <p role="status" className="text-sm">
          {result}
        </p>
      )}
      {failed && (
        <p role="alert" className="text-sm text-danger">
          {t('admin.venues.fixtures.error')}
        </p>
      )}
    </GlassCard>
  )
}

/** Own venue catalogue (Block 7, ADR 0010). Google Places stays off: no data is copied. */
export function AdminVenuesScreen() {
  const { t } = useTranslation()
  const venues = useAdminVenues()
  const fill = useFillTestVenue()
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null)
  const [filled, setFilled] = useState<{ id: string; count: number } | null>(null)

  return (
    <>
      <ScreenHeader title={t('admin.nav.venues')} description={t('admin.venues.body')} />
      <Section title={t('admin.venues.google.title')}>
        <GlassCard className="text-sm text-muted-foreground">
          {t('admin.venues.google.body')}
        </GlassCard>
      </Section>
      <FeatureGate flag="test_tools_enabled" is="on">
        <Section title={t('admin.venues.fixtures.title')}>
          <TestCatalogue venues={venues.data ?? []} />
        </Section>
      </FeatureGate>
      <Section title={t('admin.venues.listTitle')}>
        {editing ? (
          <VenueForm
            key={editing.id ?? 'new'}
            id={editing.id}
            initial={editing.draft}
            onDone={() => setEditing(null)}
          />
        ) : (
          <Button className="mb-3" onClick={() => setEditing({ id: null, draft: EMPTY })}>
            <Plus aria-hidden />
            {t('admin.venues.create')}
          </Button>
        )}
        {venues.isPending && <p role="status">{t('admin.venues.loading')}</p>}
        {venues.isError && (
          <p role="alert" className="text-sm text-danger">
            {t('admin.venues.error')}
          </p>
        )}
        {venues.data?.length === 0 && (
          <EmptyState
            icon={MapPin}
            title={t('admin.venues.emptyTitle')}
            description={t('admin.venues.emptyBody')}
          />
        )}
        <ul className="mt-3 space-y-2">
          {venues.data?.map((venue) => (
            <li key={venue.id}>
              <GlassCard className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{venue.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {[venue.city, venue.address].filter(Boolean).join(' · ')}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge>{t(`venueTypes.${venue.type}`)}</Badge>
                    {venue.isTest && <Badge>{t('admin.venues.test')}</Badge>}
                    {venue.lat === null && <Badge>{t('admin.venues.noCoords')}</Badge>}
                  </div>
                  {filled?.id === venue.id && (
                    <p role="status" className="mt-1 text-sm">
                      {t('admin.venues.fixtures.filled', { count: filled.count })}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {venue.isTest && (
                    <FeatureGate flag="test_tools_enabled" is="on">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={fill.isPending}
                        onClick={() =>
                          fill.mutate(
                            { id: venue.id, count: 25 },
                            { onSuccess: (count) => setFilled({ id: venue.id, count }) },
                          )
                        }
                      >
                        {t('admin.venues.fixtures.fill')}
                      </Button>
                    </FeatureGate>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing({ id: venue.id, draft: toDraft(venue) })}
                  >
                    {t('admin.venues.edit')}
                  </Button>
                </div>
              </GlassCard>
            </li>
          ))}
        </ul>
        {fill.isError && (
          <p role="alert" className="text-sm text-danger">
            {t('admin.venues.fixtures.error')}
          </p>
        )}
      </Section>
    </>
  )
}
