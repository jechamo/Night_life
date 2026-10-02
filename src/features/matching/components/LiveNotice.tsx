import { Users } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useMotionTokens } from '@/shared/motion/MotionPreferencesProvider'

/** Discreet live notice, e.g. "3 personas nuevas en Kapital" (PRD 6.6.1). */
export function LiveNotice({ text, onView }: { text: string | null; onView: () => void }) {
  const { t } = useTranslation()
  const tokens = useMotionTokens()
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center px-4"
    >
      <AnimatePresence>
        {text && (
          <motion.button
            type="button"
            onClick={onView}
            className="glass-strong pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm shadow-[0_8px_24px_rgb(0_0_0/0.4)]"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={tokens.spring.snappy}
          >
            <Users className="size-4 text-live" aria-hidden />
            {text}
            <span className="font-semibold text-primary">{t('matching.notice.view')}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
