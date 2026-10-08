import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router'
import { SCENES } from '@/shared/images/catalog'
import { ThemeSignature } from '@/shared/images/ThemeSignature'
import { TintedScene } from '@/shared/images/TintedScene'
import { cn } from '@/shared/lib/cn'
import { useMotionTokens } from '@/shared/motion/MotionPreferencesProvider'
import { Badge } from '@/shared/ui/badge'
import { Button, ButtonLink } from '@/shared/ui/button'
import { LanguageSwitch } from '@/shared/ui/language-switch'
import { useOnboardingStatus } from '../hooks/use-onboarding-status'

const SLIDES = ['live', 'connect', 'safe'] as const
type Slide = (typeof SLIDES)[number]
const SWIPE_PX = 60

function SlideArt({ slide }: { slide: Slide }) {
  if (slide === 'live') return <ThemeSignature priority />
  return <TintedScene image={SCENES[slide]} priority />
}

/** Animated welcome (PRD 5.2.1). Swipe or use the buttons (PRD 3.3: gestures have alternatives). */
export function WelcomeScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const tokens = useMotionTokens()
  const status = useOnboardingStatus()
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index] ?? 'live'
  const last = index === SLIDES.length - 1

  if (status.data === 'completed') return <Navigate to="/home" replace />

  const go = (next: number) => setIndex(Math.min(SLIDES.length - 1, Math.max(0, next)))
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_PX) go(index + 1)
    else if (info.offset.x > SWIPE_PX) go(index - 1)
  }

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-background">
      <AnimatePresence initial={false}>
        <motion.div
          key={slide}
          className="absolute inset-0 -z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={tokens.fade}
        >
          <SlideArt slide={slide} />
        </motion.div>
      </AnimatePresence>
      <div className="pt-safe px-safe flex min-h-16 items-center justify-between gap-3 [--nl-safe-top-gap:1rem]">
        <Badge tone="live">{t('app.name')}</Badge>
        <LanguageSwitch />
      </div>
      <motion.section
        aria-roledescription="carousel"
        aria-label={t('onboarding.welcome.slideLabel', {
          current: index + 1,
          total: SLIDES.length,
        })}
        className="px-safe mx-auto mt-auto w-full max-w-lg touch-pan-y pb-6"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.25}
        onDragEnd={onDragEnd}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={slide}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={tokens.spring.gentle}
            aria-live="polite"
          >
            <h1 className="text-4xl leading-tight font-semibold">
              {t(`onboarding.welcome.slides.${slide}.title`)}
            </h1>
            <p className="mt-3 text-lg text-muted-foreground">
              {t(`onboarding.welcome.slides.${slide}.body`)}
            </p>
          </motion.div>
        </AnimatePresence>
        <div className="mt-6 flex gap-1" role="group">
          {SLIDES.map((s, i) => (
            <button
              key={s}
              type="button"
              aria-label={t('onboarding.welcome.goToSlide', { n: i + 1 })}
              aria-current={i === index}
              onClick={() => go(i)}
              className="touch-target flex items-center justify-center"
            >
              <span
                className={cn(
                  'h-1.5 rounded-full transition-opacity',
                  i === index ? 'w-8 bg-primary' : 'w-4 bg-muted-foreground opacity-50',
                )}
              />
            </button>
          ))}
        </div>
      </motion.section>
      <footer className="px-safe mx-auto grid w-full max-w-lg gap-3 pb-[max(1.5rem,var(--nl-safe-area-bottom))]">
        {last ? (
          <Button block size="lg" onClick={() => void navigate('/onboarding')}>
            {t('onboarding.welcome.start')}
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="ghost" size="lg" onClick={() => void navigate('/onboarding')}>
              {t('common.skip')}
            </Button>
            <Button size="lg" onClick={() => go(index + 1)}>
              {t('common.next')}
            </Button>
          </div>
        )}
        <ButtonLink to="/login" variant="ghost" size="sm" block>
          {t('onboarding.login.cta')}
        </ButtonLink>
        <ButtonLink to="/guia" variant="ghost" size="sm" block>
          {t('guide.nav.howItWorks')}
        </ButtonLink>
      </footer>
    </div>
  )
}
