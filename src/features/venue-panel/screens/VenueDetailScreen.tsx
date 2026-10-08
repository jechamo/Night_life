import { CalendarPlus, Megaphone } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router'
import { Badge } from '@/shared/ui/badge'
import { Button, ButtonLink } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { SingleChoice } from '@/shared/ui/choice-group'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Section } from '@/shared/ui/section'
import { TextAreaField, TextField } from '@/shared/ui/text-field'
import {
  useCreateOfficialEvent,
  useMyVenues,
  useRequestSponsorship,
  useUpdateVenue,
  useVenueStats,
} from '../hooks/use-venue-panel'
import type { ManagedVenue, SponsorshipTier } from '../services/venue-panel-service'
import { FlashAlertForm } from '../components/FlashAlerts'
import { MusicCard } from '../components/MusicCard'
import { ProSubscriptionCard } from '../components/ProSubscriptionCard'
import { useStartVenuePurchase } from '@/features/premium/hooks/use-premium'
import { formatPrice, VENUE_PRICES } from '@/features/premium/model/catalog'
import { usePaywallState } from '@/shared/flags/use-paywall-state'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'

const TIERS: readonly SponsorshipTier[] = ['featured', 'featured_plus', 'top']
const PRICES = ['1', '2', '3', '4'] as const

function atTime(time: string, base = new Date()): string {
  const [h = 0, m = 0] = time.split(':').map(Number)
  const date = new Date(base)
  date.setHours(h, m, 0, 0)
  return date.toISOString()
}

function StatsCard({ placeId }: { placeId: string }) {
  const { t } = useTranslation()
  const { data: stats } = useVenueStats(placeId)
  if (!stats) return <GlassCard className="h-48" aria-busy="true" />
  const max = Math.max(...stats.byHour.map((h) => h.people), 1)
  return (
    <GlassCard className="space-y-4">
      {stats.pro && (
        <figure>
          <figcaption className="mb-2 text-sm text-muted-foreground">
            {t('venuePanel.stats.byHour')}
          </figcaption>
          <div
            className="flex h-32 items-end gap-1"
            role="img"
            aria-label={t('venuePanel.stats.chartLabel')}
          >
            {stats.byHour.map((h) => (
              <div key={h.hour} className="flex h-full flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-md bg-primary"
                    style={{ height: `${Math.max(4, (h.people / max) * 100)}%` }}
                  />
                </div>
                <span className="font-label text-[10px] text-muted-foreground">
                  {String(h.hour).padStart(2, '0')}
                </span>
              </div>
            ))}
          </div>
        </figure>
      )}
      <dl className="grid grid-cols-2 gap-3 text-sm">
        {stats.pro && (
          <div>
            <dt className="text-muted-foreground">{t('venuePanel.stats.averageAge')}</dt>
            <dd className="font-display text-xl">{stats.averageAge ?? '—'}</dd>
          </div>
        )}
        {stats.pro && (
          <div>
            <dt className="text-muted-foreground">{t('venuePanel.stats.green')}</dt>
            <dd className="font-display text-xl">
              {stats.greenPercent === null ? '—' : `${stats.greenPercent} %`}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-muted-foreground">{t('venuePanel.stats.checkInsWeek')}</dt>
          <dd className="font-display text-xl">{stats.checkInsWeek}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('venuePanel.stats.goingTonight')}</dt>
          <dd className="font-display text-xl">{stats.goingTonight}</dd>
        </div>
      </dl>
      {stats.pro && (
        <p className="text-sm">
          {t('venuePanel.stats.zoneAverage', { value: stats.zoneAverageCheckIns ?? '—' })}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t('venuePanel.stats.threshold')}</p>
    </GlassCard>
  )
}

function EditForm({ venue }: { venue: ManagedVenue }) {
  const { t } = useTranslation()
  const update = useUpdateVenue()
  const [description, setDescription] = useState(venue.description)
  const [hours, setHours] = useState(venue.hours)
  const [price, setPrice] = useState<(typeof PRICES)[number]>(
    String(venue.price) as (typeof PRICES)[number],
  )
  return (
    <GlassCard className="space-y-4">
      <TextAreaField
        label={t('venuePanel.edit.description')}
        value={description}
        maxLength={500}
        counter={`${description.length}/500`}
        onChange={(e) => setDescription(e.target.value)}
      />
      <TextField
        label={t('venuePanel.edit.hours')}
        value={hours}
        maxLength={60}
        onChange={(e) => setHours(e.target.value)}
      />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('venuePanel.edit.price')}</legend>
        <SingleChoice
          label={t('venuePanel.edit.price')}
          value={price}
          onChange={setPrice}
          options={PRICES.map((p) => ({ value: p, label: '€'.repeat(Number(p)) }))}
        />
      </fieldset>
      <Button
        block
        disabled={update.isPending}
        onClick={() =>
          update.mutate({
            placeId: venue.placeId,
            patch: {
              description: description.trim(),
              hours: hours.trim(),
              price: Number(price) as ManagedVenue['price'],
            },
          })
        }
      >
        {t('common.save')}
      </Button>
      {update.isSuccess && (
        <p role="status" className="text-sm text-success">
          {t('common.saved')}
        </p>
      )}
    </GlassCard>
  )
}

function OfficialEventForm({ placeId }: { placeId: string }) {
  const { t } = useTranslation()
  const create = useCreateOfficialEvent()
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('23:00')
  const [end, setEnd] = useState('05:00')
  const [description, setDescription] = useState('')
  const submit = () => {
    const startsAt = atTime(start)
    const endDate = new Date(atTime(end))
    if (end <= start) endDate.setDate(endDate.getDate() + 1)
    create.mutate(
      {
        placeId,
        input: {
          title: title.trim(),
          startsAt,
          endsAt: endDate.toISOString(),
          description: description.trim(),
        },
      },
      { onSuccess: () => setTitle('') },
    )
  }
  return (
    <GlassCard className="space-y-4">
      <TextField
        label={t('venuePanel.event.title')}
        value={title}
        maxLength={60}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          type="time"
          label={t('venuePanel.event.start')}
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <TextField
          type="time"
          label={t('venuePanel.event.end')}
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>
      <TextAreaField
        label={t('venuePanel.event.description')}
        value={description}
        maxLength={300}
        onChange={(e) => setDescription(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">{t('venuePanel.event.official')}</p>
      <Button block disabled={title.trim().length < 3 || create.isPending} onClick={submit}>
        <CalendarPlus aria-hidden />
        {t('venuePanel.event.submit')}
      </Button>
      {create.isSuccess && (
        <p role="status" className="text-sm text-success">
          {t('venuePanel.event.created')}
        </p>
      )}
    </GlassCard>
  )
}

function SponsorshipForm({ venue }: { venue: ManagedVenue }) {
  const { t, i18n } = useTranslation()
  const request = useRequestSponsorship()
  const checkout = useStartVenuePurchase()
  const selfService = useFeatureFlag('sponsorship_self_service_enabled') === 'on'
  const canBuy = usePaywallState() === 'checkout'
  const today = new Date().toISOString().slice(0, 10)
  const [tier, setTier] = useState<SponsorshipTier>('featured')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  if (venue.sponsorship?.status === 'active' || (venue.sponsorship && !selfService)) {
    return (
      <GlassCard className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">
            {t(`venuePanel.sponsor.tiers.${venue.sponsorship.tier}.name`)}
          </p>
          <Badge tone={venue.sponsorship.status === 'active' ? 'verified' : 'unconfirmed'}>
            {t(`venuePanel.sponsor.status.${venue.sponsorship.status}`)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {new Date(venue.sponsorship.from).toLocaleDateString(i18n.language)} →{' '}
          {new Date(venue.sponsorship.to).toLocaleDateString(i18n.language)}
        </p>
        <p className="text-xs text-muted-foreground">
          {t(selfService ? 'venuePanel.sponsor.paid' : 'venuePanel.sponsor.invoice')}
        </p>
      </GlassCard>
    )
  }
  return (
    <GlassCard className="space-y-4">
      <div className="grid gap-2">
        {TIERS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={tier === value}
            onClick={() => setTier(value)}
            className="rounded-theme border border-border p-3 text-left transition-opacity aria-pressed:border-primary aria-pressed:bg-surface-raised"
          >
            <span className="block font-semibold">
              {t(`venuePanel.sponsor.tiers.${value}.name`)}
            </span>
            <span className="block text-sm text-muted-foreground">
              {t(`venuePanel.sponsor.tiers.${value}.body`)}
            </span>
            {selfService && (
              <span className="block text-primary">
                {formatPrice(VENUE_PRICES[value], i18n.language)} ·{' '}
                {t('venuePanel.sponsor.duration')}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          type="date"
          label={t('venuePanel.sponsor.from')}
          min={today}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        {!selfService && (
          <TextField
            type="date"
            label={t('venuePanel.sponsor.to')}
            min={from}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t('venuePanel.sponsor.rules')}</p>
      {selfService && (
        <p className="text-xs text-muted-foreground">{t('venuePanel.sponsor.checkoutTerms')}</p>
      )}
      <Button
        block
        disabled={selfService ? !canBuy || checkout.isPending : to < from || request.isPending}
        onClick={() =>
          selfService
            ? checkout.mutate({ code: `sponsor_${tier}`, venueId: venue.placeId, from })
            : request.mutate({ placeId: venue.placeId, tier, from, to })
        }
      >
        <Megaphone aria-hidden />
        {t(selfService ? 'premium.checkout.pay' : 'venuePanel.sponsor.submit')}
      </Button>
      {(checkout.isError || (checkout.data && !checkout.data.ok)) && (
        <p role="alert" className="text-danger">
          {t('venuePanel.billingError')}
        </p>
      )}
      {selfService && !canBuy && (
        <p className="text-sm text-muted-foreground">{t('premium.comingSoon.body')}</p>
      )}
      <ButtonLink to="/legal/sponsorship" variant="ghost" size="sm" block>
        {t('publicWeb.docs.sponsorship')}
      </ButtonLink>
    </GlassCard>
  )
}

/** One managed venue: stats, edit, official events and sponsorship (PRD 6.10, 6.11). */
export function VenueDetailScreen() {
  const { t } = useTranslation()
  const { placeId = '' } = useParams()
  const { data: venues, isPending } = useMyVenues()
  const venue = venues?.find((v) => v.placeId === placeId && v.claimStatus === 'approved')
  const liveStatus = useFeatureFlag('live_status_enabled') === 'on'
  if (isPending) return null
  if (!venue) return <Navigate to="/venue" replace />
  return (
    <>
      <ScreenHeader title={venue.name} backTo="/venue" />
      <Section title={t('venuePanel.stats.title')}>
        <StatsCard placeId={venue.placeId} />
        <ProSubscriptionCard placeId={venue.placeId} />
      </Section>
      <Section title={t('venuePanel.edit.title')}>
        <EditForm venue={venue} />
      </Section>
      {liveStatus && (
        <Section title={t('venuePanel.music.title')}>
          <MusicCard placeId={venue.placeId} />
        </Section>
      )}
      <Section title={t('venuePanel.event.sectionTitle')}>
        <OfficialEventForm placeId={venue.placeId} />
      </Section>
      <Section title={t('venuePanel.sponsor.title')}>
        <SponsorshipForm venue={venue} />
      </Section>
      <div className="h-8" />
      {venue.sponsorship?.status === 'active' && venue.sponsorship.tier === 'top' && (
        <Section title={t('venuePanel.flash.title')}>
          <FlashAlertForm placeId={venue.placeId} />
        </Section>
      )}
    </>
  )
}
