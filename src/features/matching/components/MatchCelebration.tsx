import { MessageCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useMyProfile } from '@/features/profile/use-my-profile'
import { useMotionTokens } from '@/shared/motion/MotionPreferencesProvider'
import { Button } from '@/shared/ui/button'
import { TextAreaField } from '@/shared/ui/text-field'
import { matchTitle, suggestIcebreakers, type Icebreaker } from '../model/matching'
import type { Match } from '../services/matching-service'
import { AnthemChip } from './AnthemChip'

type T = ReturnType<typeof useTranslation>['t']

function icebreakerText(t: T, ice: Icebreaker): string {
  const place = ice.params.place ?? ''
  switch (ice.key) {
    case 'hereNow':
      return t('matching.icebreakers.hereNow', { place })
    case 'tonight':
      return t('matching.icebreakers.tonight', { place })
    case 'artist':
      return t('matching.icebreakers.artist', { artist: ice.params.artist ?? '' })
    case 'generic.plan':
      return t('matching.icebreakers.generic.plan')
    case 'generic.song':
      return t('matching.icebreakers.generic.song')
    case 'generic.spot':
      return t('matching.icebreakers.generic.spot')
  }
}

const MatchContext = createContext<{ celebrate: (match: Match) => void } | null>(null)
const PARTICLE_COLORS = ['bg-primary', 'bg-secondary', 'bg-accent-event', 'bg-live'] as const
const PARTICLES = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2
  const distance = 120 + (i % 3) * 50
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    color: PARTICLE_COLORS[i % 4]!,
    delay: (i % 3) * 0.05,
  }
})

/**
 * Match screen (PRD 6.6.1): both photos fly together, particles in the theme
 * colours, contextual title, both Anthems and editable rule-based icebreakers.
 * Opened by a like that matched or by a realtime "match" event.
 */
export function MatchCelebrationProvider({ children }: { children: ReactNode }) {
  const [match, setMatch] = useState<Match | null>(null)
  const celebrate = useCallback((m: Match) => setMatch(m), [])
  const value = useMemo(() => ({ celebrate }), [celebrate])
  return (
    <MatchContext value={value}>
      {children}
      <AnimatePresence>
        {match && <MatchOverlay key={match.id} match={match} onClose={() => setMatch(null)} />}
      </AnimatePresence>
    </MatchContext>
  )
}

export function useMatchCelebration() {
  const value = use(MatchContext)
  if (!value) throw new Error('useMatchCelebration must be used inside <MatchCelebrationProvider>')
  return value
}

function MatchOverlay({ match, onClose }: { match: Match; onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const tokens = useMotionTokens()
  const { data: me } = useMyProfile()
  const title = matchTitle(match.context)
  const icebreakers = suggestIcebreakers(match.context).map((ice) => icebreakerText(t, ice))
  const [draft, setDraft] = useState('')

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-title"
      className="glass-strong fixed inset-0 z-[70] flex flex-col items-center overflow-y-auto border-0 px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={tokens.fade}
    >
      <div className="relative mt-6 flex h-48 w-full max-w-xs items-center justify-center">
        {!tokens.reduced &&
          PARTICLES.map((p, i) => (
            <motion.span
              key={i}
              aria-hidden
              className={`absolute size-2.5 rounded-full ${p.color}`}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.4 }}
              transition={{
                duration: tokens.duration.slow,
                delay: 0.25 + p.delay,
                ease: 'easeOut',
              }}
            />
          ))}
        {[
          { src: me?.photos[0], from: -170, to: -42, rotate: -8 },
          { src: match.person.photos[0], from: 170, to: 42, rotate: 8 },
        ].map((photo, i) => (
          <motion.img
            key={i}
            src={photo.src}
            alt=""
            className="absolute size-36 rounded-[1.5rem] border-4 border-background object-cover shadow-[0_0_40px_var(--nl-glow)]"
            initial={{ x: photo.from, rotate: photo.rotate * 3, opacity: 0 }}
            animate={{ x: photo.to, rotate: photo.rotate, opacity: 1 }}
            transition={tokens.spring.bouncy}
          />
        ))}
      </div>
      <motion.h2
        id="match-title"
        className="mt-6 text-center text-4xl font-semibold"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...tokens.spring.gentle, delay: 0.2 }}
      >
        {title.key === 'generic'
          ? t('matching.match.generic')
          : t(`matching.match.${title.key}`, { place: title.place })}
      </motion.h2>
      <p className="mt-2 text-center text-muted-foreground">
        {t('matching.match.subtitle', { name: match.person.name })}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {me?.anthem && <AnthemChip anthem={me.anthem} />}
        {match.person.anthem && <AnthemChip anthem={match.person.anthem} />}
      </div>
      <div className="mt-6 w-full max-w-sm space-y-3">
        <p className="text-sm font-medium">{t('matching.match.icebreakers')}</p>
        <div className="flex flex-col gap-2">
          {icebreakers.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => setDraft(text)}
              className="touch-target glass rounded-2xl px-4 py-2 text-left text-sm transition-opacity active:opacity-70"
            >
              {text}
            </button>
          ))}
        </div>
        <TextAreaField
          label={t('matching.match.message')}
          value={draft}
          maxLength={500}
          onChange={(event) => setDraft(event.target.value)}
        />
      </div>
      <div className="mt-6 grid w-full max-w-sm gap-3">
        <Button
          size="lg"
          onClick={() => {
            onClose()
            void navigate(`/chats/${match.id}`, { state: { draft } })
          }}
        >
          <MessageCircle aria-hidden />
          {t('matching.match.write')}
        </Button>
        <Button variant="ghost" size="lg" onClick={onClose}>
          {t('matching.match.keepLooking')}
        </Button>
      </div>
    </motion.div>
  )
}
