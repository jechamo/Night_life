import { EVENT_COVERS, VENUE_COVERS } from '@/shared/images/catalog'
import { cn } from '@/shared/lib/cn'
import type { Place } from '../model/types'

/**
 * Generic venue/event artwork in natural colour. Real photos arrive in Block 7.
 * Text stays outside the cover, on the theme's tested opaque surfaces.
 */
export function PlaceCover({
  place,
  className,
  sizes = '(min-width: 1024px) 384px, calc(100vw - 48px)',
}: {
  place: Place
  className?: string
  sizes?: string
}) {
  const image =
    place.type === 'event'
      ? EVENT_COVERS[place.event?.coverStyle ?? 'open_air']
      : VENUE_COVERS[place.type]
  return (
    <div
      aria-hidden
      className={cn('relative isolate overflow-hidden rounded-theme bg-surface-raised', className)}
    >
      <img
        src={image.src}
        srcSet={image.srcSet}
        sizes={sizes}
        width={image.width}
        height={image.height}
        alt=""
        loading="lazy"
        decoding="async"
        className="size-full object-cover"
      />
    </div>
  )
}
