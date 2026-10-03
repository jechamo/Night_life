import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { PRESS_SCALE } from '@/shared/motion/presets'
import { Badge } from '@/shared/ui/badge'
import { LivePulse } from '@/shared/ui/live-pulse'
import { distanceMeters, formatDistance } from '../model/geo'
import { presentStats } from '../model/stats'
import { isEvent, type LatLng, type Place } from '../model/types'
import { PlaceCover } from './PlaceCover'

/** Card with inline stats (PRD 8.5). `layoutId` enables the shared-element transition. */
export function PlaceCard({
  place,
  origin,
  onSelect,
  layoutId,
}: {
  place: Place
  origin: LatLng
  onSelect: (id: string) => void
  layoutId?: string
}) {
  const { t, i18n } = useTranslation()
  const stats = presentStats(place.stats)
  return (
    <motion.button
      type="button"
      layoutId={layoutId}
      whileTap={{ scale: PRESS_SCALE }}
      onClick={() => onSelect(place.id)}
      className="glass flex w-full items-center gap-3 rounded-theme p-3 text-left"
    >
      <PlaceCover place={place} className="size-16 shrink-0 rounded-2xl" sizes="64px" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold">{place.name}</span>
          {place.stats.people > 0 && <LivePulse className="size-2" />}
        </span>
        <span className="font-label block text-xs text-muted-foreground">
          {t(`venueTypes.${place.type}`)} ·{' '}
          {formatDistance(distanceMeters(origin, place.location), i18n.language)}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
          <span className="font-semibold text-primary">
            {stats.people.kind === 'exact'
              ? t('places.peopleCount', { count: stats.people.value })
              : t('places.fewPeople')}
          </span>
          {stats.averageAge !== null && (
            <span className="text-muted-foreground">
              · {t('places.ageShort', { age: stats.averageAge })}
            </span>
          )}
          {place.sponsored && <Badge tone="sponsored">{t('badges.sponsored')}</Badge>}
          {isEvent(place) && place.event.status === 'unconfirmed' && (
            <Badge tone="unconfirmed">{t('badges.unconfirmed')}</Badge>
          )}
        </span>
      </span>
    </motion.button>
  )
}
