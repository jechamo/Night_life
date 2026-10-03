import { useTheme } from '@/shared/theme/ThemeProvider'
import type { ThemeId } from '@/shared/theme/themes'
import { THEME_SIGNATURES } from './catalog'

/** Hero image in the theme's own palette; priority is reserved for the welcome hero. */
export function ThemeSignature({
  themeId,
  priority = false,
  sizes = '100vw',
}: {
  themeId?: ThemeId
  priority?: boolean
  sizes?: string
}) {
  const { themeId: active } = useTheme()
  const image = THEME_SIGNATURES[themeId ?? active]
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <img
        src={image.src}
        srcSet={image.srcSet}
        sizes={sizes}
        width={image.width}
        height={image.height}
        alt=""
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className="size-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background from-10% via-background/85 via-40% to-transparent" />
    </div>
  )
}
