import type { LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { riseIn, staggerChildren } from '@/shared/motion/presets'
import { useMotionTokens } from '@/shared/motion/MotionPreferencesProvider'

/**
 * Animated empty state (PRD 8.4). The icon "floats" with an ambient loop; ambient
 * loops are exempt from the 150-400 ms rule (they are not transitions) and stop
 * completely when motion is reduced.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  footnote,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  footnote?: string
  action?: ReactNode
}) {
  const tokens = useMotionTokens()
  return (
    <motion.div
      className="flex flex-col items-center px-6 py-12 text-center"
      variants={staggerChildren(0.06)}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={riseIn} transition={tokens.spring.gentle} className="relative mb-6">
        <span
          className="absolute inset-0 rounded-full bg-primary opacity-30 blur-2xl"
          aria-hidden
        />
        <motion.span
          className="glass relative flex size-20 items-center justify-center rounded-full text-primary"
          animate={tokens.reduced ? undefined : { y: [0, -6, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Icon className="size-9" aria-hidden />
        </motion.span>
      </motion.div>
      <motion.h2
        variants={riseIn}
        transition={tokens.spring.gentle}
        className="text-2xl font-semibold"
      >
        {title}
      </motion.h2>
      <motion.p
        variants={riseIn}
        transition={tokens.spring.gentle}
        className="mt-2 max-w-sm text-muted-foreground"
      >
        {description}
      </motion.p>
      {footnote && (
        <motion.p
          variants={riseIn}
          transition={tokens.spring.gentle}
          className="font-label mt-4 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
        >
          {footnote}
        </motion.p>
      )}
      {action && (
        <motion.div variants={riseIn} transition={tokens.spring.gentle} className="mt-6">
          {action}
        </motion.div>
      )}
    </motion.div>
  )
}
