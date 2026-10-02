import { useTheme } from '@/shared/theme/ThemeProvider'
import type { ThemeId } from '@/shared/theme/themes'
import { THEME_SIGNATURES } from './catalog'
import { LiveCityArt } from './LiveCityArt'

/** Hero image of a theme (its own palette), or the CSS fallback until it exists. */
export function ThemeSignature({ themeId }: { themeId?: ThemeId }) {
  const { themeId: active } = useTheme()
  const image = THEME_SIGNATURES[themeId ?? active]
  if (!image) return <LiveCityArt />
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <img
        src={image.src}
        srcSet={image.srcSet}
        sizes="100vw"
        width={image.width}
        height={image.height}
        alt=""
        decoding="async"
        className="size-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
    </div>
  )
}
