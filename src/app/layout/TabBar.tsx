import { Map, MessageCircle, PartyPopper, User, type LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { cn } from '@/shared/lib/cn'
import { PRESS_SCALE } from '@/shared/motion/presets'
import { useMotionTokens } from '@/shared/motion/MotionPreferencesProvider'

type TabKey = 'discover' | 'tonight' | 'chats' | 'profile'

const TABS: readonly { key: TabKey; to: string; icon: LucideIcon }[] = [
  { key: 'discover', to: '/discover', icon: Map },
  { key: 'tonight', to: '/tonight', icon: PartyPopper },
  { key: 'chats', to: '/chats', icon: MessageCircle },
  { key: 'profile', to: '/profile', icon: User },
]

/** Floating glass tab bar (PRD 5.1, 8.5). The active pill slides with a spring. */
export function TabBar() {
  const { t } = useTranslation()
  const tokens = useMotionTokens()
  return (
    <nav
      aria-label={t('tabs.label')}
      className="px-safe pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <ul className="glass-strong pointer-events-auto flex w-full max-w-md gap-1 rounded-full p-1.5 shadow-[0_12px_40px_rgb(0_0_0/0.5)]">
        {TABS.map(({ key, to, icon: Icon }) => (
          <li key={key} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'relative isolate flex h-14 rounded-full text-[0.7rem] font-medium transition-opacity',
                  isActive ? 'text-primary-foreground' : 'text-muted-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="tabbar-active"
                      className="absolute inset-0 -z-10 rounded-full bg-primary shadow-[0_0_20px_var(--nl-glow)]"
                      transition={tokens.spring.snappy}
                    />
                  )}
                  <motion.span
                    tabIndex={-1}
                    whileTap={tokens.reduced ? undefined : { scale: PRESS_SCALE }}
                    className="font-label flex size-full flex-col items-center justify-center gap-0.5"
                  >
                    <Icon className="size-5" aria-hidden />
                    {t(`tabs.${key}`)}
                  </motion.span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
