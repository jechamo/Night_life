import { Check } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { THEME_SIGNATURES } from '@/shared/images/catalog'
import { cn } from '@/shared/lib/cn'
import { PRESS_SCALE, stamp } from '@/shared/motion/presets'
import { useMotionTokens } from '@/shared/motion/MotionPreferencesProvider'
import { THEMES, type ThemeId } from '@/shared/theme/themes'
import { LivePulse } from '@/shared/ui/live-pulse'

const SWATCHES = [
  'bg-primary',
  'bg-secondary',
  'bg-live',
  'bg-accent-event',
  'bg-accent-pub',
] as const

/**
 * Self-themed preview: `data-theme` re-scopes every CSS variable inside the card,
 * so each card is painted with its own theme regardless of the active one.
 */
export function ThemePreviewCard({
  themeId,
  selected,
  onSelect,
}: {
  themeId: ThemeId
  selected: boolean
  onSelect: (id: ThemeId) => void
}) {
  const { t } = useTranslation()
  const tokens = useMotionTokens()
  const image = THEME_SIGNATURES[themeId]
  return (
    <motion.button
      type="button"
      data-theme={themeId}
      aria-pressed={selected}
      onClick={() => onSelect(themeId)}
      whileTap={{ scale: PRESS_SCALE }}
      className={cn(
        'relative isolate flex w-full flex-col overflow-hidden rounded-theme border bg-background p-4 text-left text-foreground',
        selected ? 'border-primary shadow-[0_0_28px_var(--nl-glow)]' : 'border-border',
      )}
    >
      <span aria-hidden className="relative -mx-4 -mt-4 mb-4 block h-24 overflow-hidden">
        <img
          src={image.src}
          srcSet={image.srcSet}
          sizes="(min-width: 640px) 240px, 50vw"
          width={image.width}
          height={image.height}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover object-[center_30%]"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      </span>
      <span className="flex items-start justify-between gap-2">
        <span className="font-display text-xl font-semibold">{t(`themes.${themeId}.name`)}</span>
        <AnimatePresence>
          {selected && (
            <motion.span
              variants={stamp}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={tokens.spring.bouncy}
              className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Check className="size-4" aria-hidden />
              <span className="sr-only">{t('themes.active')}</span>
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span className="mt-1 text-sm text-muted-foreground">
        {t(`themes.${themeId}.description`)}
      </span>
      <span className="mt-4 flex items-center justify-between gap-3">
        <span className="flex -space-x-1.5" aria-hidden>
          {SWATCHES.map((swatch) => (
            <span
              key={swatch}
              className={cn('size-6 rounded-full border-2 border-background', swatch)}
            />
          ))}
        </span>
        <span className="glass font-label inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-live">
          <LivePulse className="size-2" />
          {t(THEMES[themeId].premium ? 'themes.pass' : 'themes.free')}
        </span>
      </span>
    </motion.button>
  )
}
