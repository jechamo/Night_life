import { Heart, Rewind, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useMotionTokens } from '@/shared/motion/MotionPreferencesProvider'
import { Button } from '@/shared/ui/button'
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
}: {
  candidates: readonly Candidate[]
  onLike: (candidate: Candidate) => Promise<LikeOutcome>
  onPass: (candidate: Candidate) => void
  onUndo: () => Promise<boolean>
  canUndo: boolean
  empty: React.ReactNode
}) {
  const { t } = useTranslation()
  const tokens = useMotionTokens()
  const [history, setHistory] = useState<SwipeDirection[]>([])
  const [exit, setExit] = useState<Exit>({ dir: 'none' })
  const [rewinding, setRewinding] = useState(false)
  // One decision at a time: a second tap while the like is in flight would like twice.
  const deciding = useRef(false)
  const index = history.length
  const top = candidates[index]
  const next = candidates[index + 1]

  const decide = async (dir: SwipeDirection) => {
    if (!top || deciding.current) return
    deciding.current = true
    try {
      if (dir === 'like' && (await onLike(top)) === 'limit') return
      if (dir === 'pass') onPass(top)
      setRewinding(false)
      setExit({ dir })
      setHistory((h) => [...h, dir])
    } finally {
      deciding.current = false
    }
  }

  const undo = async () => {
    if (history.at(-1) !== 'pass' || !(await onUndo())) return
    setRewinding(true)
    setExit({ dir: 'none' })
    setHistory((h) => h.slice(0, -1))
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight') void decide('like')
    if (event.key === 'ArrowLeft') void decide('pass')
  }

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
            disabled={history.at(-1) !== 'pass'}
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
