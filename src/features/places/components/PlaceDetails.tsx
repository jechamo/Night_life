import { Clock, Euro, Globe, MapPin, Music, Phone, Shirt, UserCheck } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAttendance } from '@/features/attendance/hooks/use-attendance'
import { usePlaceDetail } from '@/features/home/hooks/use-dashboard'
import { Badge } from '@/shared/ui/badge'
import { FlashAlerts } from '@/features/venue-panel/components/FlashAlerts'
import { Chip } from '@/shared/ui/chip'
import type { OpeningPeriod } from '../model/cities'
import { distanceMeters, formatDistance } from '../model/geo'
import { isEvent, type LatLng, type Place } from '../model/types'
import { EventActions } from './EventActions'
import { LostFoundPanel } from './LostFoundPanel'
import { PlaceActions } from './PlaceActions'
import { PlaceCover } from './PlaceCover'
import { VibeCheck } from './VibeCheck'
import { WhoIsThere } from './WhoIsThere'
import { FavoriteButton } from './FavoriteButton'

/** "Lun 18:00–06:00" lines, Monday first, in the user's language. */
function openingLines(periods: readonly OpeningPeriod[], language: string): string[] {
  const weekday = new Intl.DateTimeFormat(language, { weekday: 'short', timeZone: 'UTC' })
  return [...periods]
    .sort((a, b) => a.day - b.day || a.opens.localeCompare(b.opens))
    .map((p) => `${weekday.format(new Date(Date.UTC(2024, 0, 1 + p.day)))} ${p.opens}–${p.closes}`)
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <dt className="sr-only">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** Content of the place sheet / desktop side panel (PRD 5.3). Only our own catalogue data. */
export function PlaceDetails({ place, origin }: { place: Place; origin: LatLng }) {
  const { t, i18n } = useTranslation()
  const { data: attendance } = useAttendance()
  const detail = usePlaceDetail(place.id, !isEvent(place))
  const [showLostFound, setShowLostFound] = useState(false)
  const checkedInHere = attendance?.checkIn?.placeId === place.id
  const hours = place.openingHours?.length
    ? openingLines(place.openingHours, i18n.language)
    : place.hours
      ? [place.hours]
      : []

  return (
    <div className="space-y-6 pb-4">
      <div className="relative">
        <PlaceCover place={place} className="h-32" />
        {!isEvent(place) && (
          <div className="absolute right-2 top-2">
            <FavoriteButton
              place={{ ...place, favorite: detail.data?.favorite ?? place.favorite }}
            />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip accent={place.type} selected tabIndex={-1} className="pointer-events-none">
          {t(`venueTypes.${place.type}`)}
        </Chip>
        {place.sponsored && <Badge tone="sponsored">{t('badges.sponsored')}</Badge>}
        {place.openNow ? (
          <Badge tone="live">{t('places.openNow')}</Badge>
        ) : (
          <Badge>{t('places.closed')}</Badge>
        )}
        <span className="font-label text-xs text-muted-foreground">
          {formatDistance(distanceMeters(origin, place.location), i18n.language)}
        </span>
      </div>
      <WhoIsThere stats={place.stats} />
      {!isEvent(place) && <FlashAlerts placeId={place.id} />}
      {place.description && <p className="text-sm">{place.description}</p>}
      <dl className="grid gap-2 text-sm">
        {hours.length > 0 && (
          <Detail icon={Clock} label={t('places.hours')}>
            <ul className="space-y-0.5">
              {hours.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Detail>
        )}
        {place.price && (
          <Detail icon={Euro} label={t('places.price')}>
            <span aria-label={t('places.priceLevel', { level: place.price })}>
              {'€'.repeat(place.price)}
            </span>
          </Detail>
        )}
        {place.address && (
          <Detail icon={MapPin} label={t('places.address')}>
            {place.address}
          </Detail>
        )}
        {place.phone && (
          <Detail icon={Phone} label={t('places.details.phone')}>
            <a className="underline-offset-2 hover:underline" href={`tel:${place.phone}`}>
              {place.phone}
            </a>
          </Detail>
        )}
        {place.website && (
          <Detail icon={Globe} label={t('places.details.website')}>
            <a
              className="underline-offset-2 hover:underline"
              href={place.website}
              rel="noopener noreferrer"
              target="_blank"
            >
              {hostOf(place.website)}
            </a>
          </Detail>
        )}
        {place.music && place.music.length > 0 && (
          <Detail icon={Music} label={t('places.details.music')}>
            {place.music.join(' · ')}
          </Detail>
        )}
        {place.dressCode && (
          <Detail icon={Shirt} label={t('places.details.dressCode')}>
            {place.dressCode}
          </Detail>
        )}
        {place.minAge !== undefined && (
          <Detail icon={UserCheck} label={t('places.details.minAgeLabel')}>
            {t('places.details.minAge', { age: place.minAge })}
          </Detail>
        )}
      </dl>
      {isEvent(place) && <EventActions place={place} event={place.event} />}
      <PlaceActions place={place} onToggleLostFound={() => setShowLostFound((v) => !v)} />
      <VibeCheck place={place} checkedInHere={checkedInHere} />
      {showLostFound && <LostFoundPanel placeId={place.id} />}
      {place.source === 'osm' && (
        <p className="text-xs text-muted-foreground">
          {t('places.osmAttribution')}{' '}
          <a
            className="underline underline-offset-2"
            href="https://www.openstreetmap.org/copyright"
            rel="noopener noreferrer"
            target="_blank"
          >
            {t('places.osmCredit')}
          </a>
        </p>
      )}
    </div>
  )
}
