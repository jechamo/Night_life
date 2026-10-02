import { cn } from '@/shared/lib/cn'
import type { ImageAsset } from './catalog'

/**
 * Greyscale scene tinted with the active theme (PRD 8.2: everything is tokens).
 * `mix-blend-mode: color` paints the theme hue over the luminance of the photo;
 * in Mono the primary is white, so the image simply stays black and white.
 * A bottom fade to the background keeps overlaid text at AA contrast.
 */
export function TintedScene({
  image,
  className,
  priority = false,
}: {
  image: ImageAsset
  className?: string
  priority?: boolean
}) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 isolate overflow-hidden', className)}
    >
      <img
        src={image.src}
        srcSet={image.srcSet}
        sizes="(min-width: 768px) 50vw, 100vw"
        width={image.width}
        height={image.height}
        alt=""
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="size-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary opacity-70 mix-blend-color" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
    </div>
  )
}
