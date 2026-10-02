import { MapPinCheck } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { stamp } from '@/shared/motion/presets'
import { useMotionTokens } from '@/shared/motion/MotionPreferencesProvider'

/** Check-in signature moment (PRD 8.4): rings burst and a stamp lands. ~1.5 s, then it leaves. */
export function CheckInCelebration({
  placeName,
  onDone,
}: {
  placeName: string | null
  onDone: () => void
}) {
  const { t } = useTranslation()
  const tokens = useMotionTokens()
  useEffect(() => {
    if (!placeName) return
    const id = setTimeout(onDone, 1600)
    return () => clearTimeout(id)
  }, [placeName, onDone])

  return (
    <AnimatePresence>
      {placeName && (
        <motion.div
          role="status"
          className="pointer-events-none fixed inset-0 z-[60] flex flex-col items-center justify-center bg-background/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={tokens.fade}
        >
          {!tokens.reduced &&
            [0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="absolute size-40 rounded-full border-2 border-primary"
                initial={{ scale: 0.4, opacity: 0.9 }}
                animate={{ scale: 2.4, opacity: 0 }}
                transition={{ duration: tokens.duration.slow, delay: i * 0.12, ease: 'easeOut' }}
              />
            ))}
          <motion.span
            variants={stamp}
            initial="hidden"
            animate="visible"
            transition={tokens.spring.bouncy}
            className="flex size-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_48px_var(--nl-glow)]"
          >
            <MapPinCheck className="size-12" aria-hidden />
          </motion.span>
          <p className="font-display mt-6 text-2xl font-semibold">
            {t('places.checkIn.done', { place: placeName })}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
