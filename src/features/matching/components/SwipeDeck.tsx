import { Heart, Rewind, Sparkles, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useMotionTokens } from '@/shared/motion/MotionPreferencesProvider'
import { Button, ButtonLink } from '@/shared/ui/button'
import type { Candidate } from '../model/people'
import { SwipeCard, type SwipeDirection } from './SwipeCard'

export type LikeOutcome = 'ok' | 'limit'

interface Exit {
  dir: SwipeDirection | 'none'
}

const cardVariants = {
  enter: (rewind: boolean) =>
    rewind ? { x: -420, rotate: -24, opacity: 0 } : { scale: 0.94, y: 16, opacity: 0 },
  top: { x: 0, rotate: 0, scale: 1, y: 0, opacity: 1 },
  under: { scale: 0.94, y: 16, opacity: 0.7 },
  exit: ({ dir }: Exit) => ({
    x: dir === 'like' ? 560 : dir === 'pass' ? -560 : 0,
    rotate: dir === 'like' ? 22 : dir === 'pass' ? -22 : 0,
    opacity: 0,
  }),
}

/**
 * Card stack with depth (PRD 6.6.1): the next card peeks underneath, scaled and
 * blurred. Every gesture has a button (PRD 3.3), plus ← / → on the keyboard.
 */
export function SwipeDeck({
  candidates,
  onLike,
  onPass,
  onUndo,
  canUndo,
  empty,
  onSpark,
  sparkBalance = 0,
  sponsors = [],
}: {
  candidates: readonly Candidate[]
  onLike: (candidate: Candidate) => Promise<LikeOutcome>
  onPass: (candidate: Candidate) => Promise<void>
  onUndo: () => Promise<boolean>
  canUndo: boolean
  empty: React.ReactNode
  onSpark?: (candidate: Candidate) => Promise<LikeOutcome>
  sparkBalance?: number
  sponsors?: readonly { id: string; name: string }[]
}) {
  const { t } = useTranslation()
  const tokens = useMotionTokens()
  const [history, setHistory] = useState<{ dir: SwipeDirection; id: string }[]>([])
  const [exit, setExit] = useState<Exit>({ dir: 'none' })
  const [rewinding, setRewinding] = useState(false)
  const [adsShown, setAdsShown] = useState(0)
  // One decision at a time: a second tap while the like is in flight would like twice.
  const deciding = useRef(false)
  const available = candidates.filter((c) => !history.some((h) => h.id === c.profile.id))
  const [top, next] = available

  const decide = async (dir: SwipeDirection, spark = false) => {
    if (!top || deciding.current) return
    deciding.current = true
    try {
      if (dir === 'like' && (await (spark && onSpark ? onSpark(top) : onLike(top))) === 'limit')
        return
      if (dir === 'pass') await onPass(top)
      setRewinding(false)
      setExit({ dir })
      setHistory((h) => [...h, { dir, id: top.profile.id }])
    } catch {
      // The mutation exposes a translated error in the screen; keep the current card.
      return
    } finally {
      deciding.current = false
    }
  }

  const undo = async () => {
    if (deciding.current || history.at(-1)?.dir !== 'pass') return
    deciding.current = true
    try {
      if (!(await onUndo())) return
      setRewinding(true)
      setExit({ dir: 'none' })
      setHistory((h) => h.slice(0, -1))
    } catch {
      return
    } finally {
      deciding.current = false
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight') void decide('like')
    if (event.key === 'ArrowLeft') void decide('pass')
  }

  const sponsor = sponsors[adsShown % sponsors.length]
  if (sponsor && Math.floor(history.length / 10) > adsShown)
    return (
      <div className="glass mx-auto flex aspect-[3/4] w-full max-w-sm flex-col items-center justify-center gap-4 rounded-theme p-5">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          {t('premium.social.sponsored')}
        </span>
        <p className="font-display text-2xl">{sponsor.name}</p>
        <p className="text-center text-sm text-muted-foreground">
          {t('premium.social.sponsorBody')}
        </p>
        <ButtonLink to={`/discover?place=${sponsor.id}`}>
          {t('premium.social.viewVenue')}
        </ButtonLink>
        <Button variant="ghost" onClick={() => setAdsShown((n) => n + 1)}>
          {t('common.continue')}
        </Button>
      </div>
    )
  if (!top) return <>{empty}</>

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div
        className="relative mx-auto aspect-[3/4] w-full max-w-sm flex-1 outline-none"
        tabIndex={0}
        role="group"
        aria-roledescription={t('matching.deckLabel')}
        aria-label={t('matching.deckHint')}
        onKeyDown={onKeyDown}
      >
        <AnimatePresence initial={false} custom={exit}>
          {next && (
            <motion.div
              key={next.profile.id}
              className="absolute inset-0 blur-[2px]"
              variants={cardVariants}
              initial="enter"
              animate="under"
              transition={tokens.spring.gentle}
            >
              <SwipeCard candidate={next} onDecide={() => undefined} />
            </motion.div>
          )}
          <motion.div
            key={top.profile.id}
            className="absolute inset-0 z-10"
            custom={rewinding}
            variants={cardVariants}
            initial={rewinding ? 'enter' : 'under'}
            animate="top"
            exit="exit"
            transition={tokens.spring.snappy}
          >
            <SwipeCard candidate={top} onDecide={(dir) => void decide(dir)} />
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex items-center justify-center gap-4">
        {onSpark && (
          <Button
            variant="glass"
            size="icon"
            className="size-14"
            disabled={sparkBalance <= 0}
            aria-label={t('premium.social.spark', { count: sparkBalance })}
            onClick={() => void decide('like', true)}
          >
            <Sparkles className="text-warning" aria-hidden />
          </Button>
        )}
        <Button
          variant="glass"
          size="icon"
          className="size-14"
          aria-label={t('matching.pass')}
          onClick={() => void decide('pass')}
        >
          <X className="size-7! text-danger" aria-hidden />
        </Button>
        {canUndo && (
          <Button
            variant="glass"
            size="icon"
            aria-label={t('matching.undo')}
            disabled={history.at(-1)?.dir !== 'pass'}
            onClick={() => void undo()}
          >
            <Rewind className="text-warning" aria-hidden />
          </Button>
        )}
        <Button
          size="icon"
          className="size-16"
          aria-label={t('matching.like')}
          onClick={() => void decide('like')}
        >
          <Heart className="size-8! fill-current" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
