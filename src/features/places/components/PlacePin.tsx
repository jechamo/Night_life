import { motion, type MotionValue } from 'motion/react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { VENUE_ICONS } from '@/shared/domain/venue-icons'
import { cn } from '@/shared/lib/cn'
import { accentVar } from '@/shared/ui/chip'
import { LivePulse } from '@/shared/ui/live-pulse'
import { presentStats } from '../model/stats'
import { isEvent, type Place } from '../model/types'

export const MAP_TILT_DEG = 38

/**
 * Map pin (PRD 5.3): people + average age badge, live halo, "Patrocinado" and
 * "No confirmado" labels. Counter-rotated and counter-scaled so it stands upright
 * at a constant size on the tilted 3D map.
 */
export function PlacePin({
  place,
  x,
  y,
  inverseScale,
  selected,
  onSelect,
}: {
  place: Place
  x: number
  y: number
  inverseScale: MotionValue<number>
  selected: boolean
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation()
  const Icon = VENUE_ICONS[place.type]
  const stats = presentStats(place.stats)
  const people =
    stats.people.kind === 'exact' ? String(stats.people.value) : `<${stats.people.value}`
  const unconfirmed = isEvent(place) && place.event.status === 'unconfirmed'
  const label = [
    place.name,
    t(`venueTypes.${place.type}`),
    stats.people.kind === 'exact'
      ? t('places.peopleCount', { count: stats.people.value })
      : t('places.fewPeople'),
    place.sponsored ? t('badges.sponsored') : null,
    unconfirmed ? t('badges.unconfirmed') : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <motion.div
      className="absolute"
      style={{
        left: x,
        top: y,
        rotateX: -MAP_TILT_DEG,
        scale: inverseScale,
        transformOrigin: '50% 100%',
        translateX: '-50%',
        translateY: '-100%',
        zIndex: selected ? 30 : 10,
      }}
    >
      <motion.button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        // A press on a pin is a selection, never the start of a map pan.
        onPointerDownCapture={(event) => event.stopPropagation()}
        onClick={() => onSelect(place.id)}
        animate={{ scale: selected ? 1.18 : 1 }}
        whileTap={{ scale: 0.92 }}
        className="flex flex-col items-center"
        style={{ '--pin': accentVar(place.type) } as CSSProperties}
      >
        <span className="glass font-label mb-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold whitespace-nowrap">
          <span className="text-[var(--pin)]">{people}</span>
          {stats.averageAge !== null && (
            <span className="text-muted-foreground">· {stats.averageAge}</span>
          )}
        </span>
        <span
          className={cn(
            'relative flex size-11 items-center justify-center rounded-full border-2 bg-[var(--pin)] text-background shadow-[0_0_24px_var(--pin)]',
            selected ? 'border-foreground' : 'border-background',
          )}
        >
          {place.stats.people > 0 && <LivePulse className="absolute -top-0.5 -right-0.5 size-3" />}
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="h-3 w-0.5 bg-[var(--pin)]" aria-hidden />
        {(place.sponsored || unconfirmed) && (
          <span
            className={cn(
              'font-label mt-0.5 rounded-full border px-1.5 text-[0.6rem] font-semibold whitespace-nowrap',
              unconfirmed
                ? 'border-warning bg-surface text-warning'
                : 'border-border bg-surface text-foreground',
            )}
          >
            {unconfirmed ? t('badges.unconfirmed') : t('badges.sponsored')}
          </span>
        )}
      </motion.button>
    </motion.div>
  )
}
