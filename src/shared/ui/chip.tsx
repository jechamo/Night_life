import { motion, type HTMLMotionProps } from 'motion/react'
import type { CSSProperties, ReactNode } from 'react'
import type { AccentKey } from '@/shared/domain/venue-types'
import { cn } from '@/shared/lib/cn'
import { PRESS_SCALE } from '@/shared/motion/presets'

export interface ChipProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  /** Venue/event accent colour (PRD 8.2). Defaults to the theme primary. */
  accent?: AccentKey
  selected?: boolean
  icon?: ReactNode
  children: ReactNode
}

export const accentVar = (accent?: AccentKey): string =>
  accent ? `var(--nl-accent-${accent.replace(/_/g, '-')})` : 'var(--nl-primary)'

/** Toggle chip. Colour is never the only signal: the label always names the type. */
export function Chip({
  accent,
  selected = false,
  icon,
  className,
  style,
  children,
  ...props
}: ChipProps) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      whileTap={{ scale: PRESS_SCALE }}
      style={{ '--chip-accent': accentVar(accent), ...style } as CSSProperties}
      className={cn(
        'touch-target font-label inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium',
        'border-[var(--chip-accent)] transition-opacity',
        selected
          ? 'bg-[var(--chip-accent)] text-background'
          : 'glass border-[var(--chip-accent)] text-[var(--chip-accent)]',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </motion.button>
  )
}
