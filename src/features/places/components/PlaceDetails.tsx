import { Clock, Euro, MapPin } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAttendance } from '@/features/attendance/hooks/use-attendance'
import { Badge } from '@/shared/ui/badge'
import { Chip } from '@/shared/ui/chip'
import { distanceMeters, formatDistance } from '../model/geo'
import { isEvent, type LatLng, type Place } from '../model/types'
import { EventActions } from './EventActions'
import { LostFoundPanel } from './LostFoundPanel'
import { PlaceActions } from './PlaceActions'
import { PlaceCover } from './PlaceCover'
import { VibeCheck } from './VibeCheck'
import { WhoIsThere } from './WhoIsThere'

/** Content of the place sheet / desktop side panel (PRD 5.3). */
export function PlaceDetails({ place, origin }: { place: Place; origin: LatLng }) {
  const { t, i18n } = useTranslation()
  const { data: attendance } = useAttendance()
  const [showLostFound, setShowLostFound] = useState(false)
  const checkedInHere = attendance?.checkIn?.placeId === place.id

  return (
    <div className="space-y-6 pb-4">
      <PlaceCover place={place} className="h-32" />
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
      <dl className="grid gap-2 text-sm">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-primary" aria-hidden />
          <dt className="sr-only">{t('places.hours')}</dt>
          <dd>{place.hours}</dd>
        </div>
        <div className="flex items-center gap-2">
          <Euro className="size-4 text-primary" aria-hidden />
          <dt className="sr-only">{t('places.price')}</dt>
          <dd aria-label={t('places.priceLevel', { level: place.price })}>
            {'€'.repeat(place.price)}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-primary" aria-hidden />
          <dt className="sr-only">{t('places.address')}</dt>
          <dd>{place.address}</dd>
        </div>
      </dl>
      {isEvent(place) && <EventActions place={place} event={place.event} />}
      <PlaceActions place={place} onToggleLostFound={() => setShowLostFound((v) => !v)} />
      <VibeCheck place={place} checkedInHere={checkedInHere} />
      {showLostFound && <LostFoundPanel placeId={place.id} />}
    </div>
  )
}
