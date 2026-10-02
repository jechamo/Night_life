import { cva, type VariantProps } from 'class-variance-authority'
import { BadgeCheck } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { stamp } from '@/shared/motion/presets'
import { useMotionTokens } from '@/shared/motion/MotionPreferencesProvider'
import { LivePulse } from './live-pulse'

const badgeVariants = cva(
  'font-label inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold [&_svg]:size-3.5',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-raised text-foreground',
        verified: 'bg-secondary text-secondary-foreground',
        live: 'glass text-live',
        hereNow: 'bg-primary text-primary-foreground shadow-[0_0_16px_var(--nl-glow)]',
        // Legal labels must always be legible (PRD 6.11, 8.5).
        sponsored: 'border border-border bg-surface text-foreground',
        unconfirmed: 'border border-warning bg-surface text-warning',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: ReactNode
  className?: string
  /** Plays the "sello" stamp entrance (verification badges). */
  stampIn?: boolean
}

export function Badge({ tone, children, className, stampIn = false }: BadgeProps) {
  const tokens = useMotionTokens()
  const content = (
    <>
      {tone === 'verified' && <BadgeCheck aria-hidden />}
      {tone === 'live' && <LivePulse className="size-2" />}
      {children}
    </>
  )
  if (!stampIn) return <span className={cn(badgeVariants({ tone }), className)}>{content}</span>
  return (
    <motion.span
      className={cn(badgeVariants({ tone }), className)}
      variants={stamp}
      initial="hidden"
      animate="visible"
      transition={tokens.spring.bouncy}
    >
      {content}
    </motion.span>
  )
}
