import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { useEffect } from 'react'
import { cn } from '@/shared/lib/cn'
import { useMotionTokens } from '@/shared/motion/MotionPreferencesProvider'
import { EASE_OUT } from '@/shared/motion/tokens'

const defaultFormat = (n: number) => n.toLocaleString()

/**
 * Number that counts up/down to its value (PRD 6.4, 8.4 "contadores que cuentan").
 * Screen readers get the final value only, never every intermediate frame.
 */
export function AnimatedCounter({
  value,
  format = defaultFormat,
  className,
}: {
  value: number
  format?: (n: number) => string
  className?: string
}) {
  const tokens = useMotionTokens()
  const current = useMotionValue(tokens.reduced ? value : 0)
  const text = useTransform(current, (v) => format(Math.round(v)))

  useEffect(() => {
    if (tokens.reduced) {
      current.set(value)
      return
    }
    const controls = animate(current, value, { duration: tokens.duration.slow, ease: EASE_OUT })
    return () => controls.stop()
  }, [value, current, tokens.reduced, tokens.duration.slow])

  return (
    <span className={cn('tabular-nums', className)}>
      <motion.span aria-hidden>{text}</motion.span>
      <span className="sr-only">{format(value)}</span>
    </span>
  )
}
