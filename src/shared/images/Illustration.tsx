import { cn } from '@/shared/lib/cn'
import { ILLUSTRATIONS, type IllustrationName } from './catalog'

/**
 * Shared clay artwork: the radial mask keeps the figure and fades the square edges.
 * Screen blending integrates the black background; Mono omits decorative glow.
 */
export function Illustration({ name, className }: { name: IllustrationName; className?: string }) {
  const image = ILLUSTRATIONS[name]
  return (
    // No `isolate` here on purpose: the screen blend must reach the page/sheet
    // background so the image's black backdrop disappears.
    <div aria-hidden className={cn('relative mx-auto size-44', className)}>
      <span className="nl-illustration-glow absolute inset-[18%] rounded-full bg-gradient-to-br from-primary to-secondary opacity-60 blur-2xl" />
      <img
        src={image.src}
        srcSet={image.srcSet}
        sizes="176px"
        width={image.width}
        height={image.height}
        alt=""
        loading="lazy"
        decoding="async"
        className="nl-illustration-fade relative size-full object-contain mix-blend-screen"
      />
    </div>
  )
}
