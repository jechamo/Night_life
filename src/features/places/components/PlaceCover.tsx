import type { CSSProperties } from 'react'
import { VENUE_ICONS } from '@/shared/domain/venue-icons'
import { cn } from '@/shared/lib/cn'
import { accentVar } from '@/shared/ui/chip'
import type { Place } from '../model/types'

/**
 * Cover art per place type, painted with the type accent. Real photos (Google
 * Places / venue panel) replace it from Block 7; the GPT venue covers can slot in here.
 */
export function PlaceCover({ place, className }: { place: Place; className?: string }) {
  const Icon = VENUE_ICONS[place.type]
  return (
    <div
      aria-hidden
      style={{ '--cover': accentVar(place.type) } as CSSProperties}
      className={cn('relative isolate overflow-hidden rounded-theme bg-surface-raised', className)}
    >
      <div className="absolute -top-10 -left-10 size-48 rounded-full bg-[var(--cover)] opacity-40 blur-3xl" />
      <div className="absolute -right-8 -bottom-16 size-56 rounded-full bg-primary opacity-20 blur-3xl" />
      <Icon
        className="absolute right-4 bottom-3 size-16 text-[var(--cover)] opacity-80"
        strokeWidth={1.25}
      />
    </div>
  )
}
