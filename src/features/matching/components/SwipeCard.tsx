import { Info } from 'lucide-react'
import { motion, useMotionValue, useTransform, type PanInfo } from 'motion/react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { usePlatform } from '@/platform'
import { cn } from '@/shared/lib/cn'
import type { Candidate } from '../model/people'
import { ProfileHighlights } from './ProfileHighlights'

export type SwipeDirection = 'like' | 'pass'
const DECIDE_OFFSET = 120
const DECIDE_VELOCITY = 650

/**
 * Swipe card with real physics (PRD 6.6.1): tilts with the finger, "ME GUSTA" / "PASO"
 * stamps fade in proportionally, flicks away with enough speed or springs back.
 * Tap the left/right side to change photo. Buttons in the deck do the same (a11y).
 */
export function SwipeCard({
  candidate,
  onDecide,
}: {
  candidate: Candidate
  onDecide: (dir: SwipeDirection) => void
}) {
  const { t } = useTranslation()
  const { haptics } = usePlatform()
  const { profile } = candidate
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-240, 240], [-14, 14])
  const likeOpacity = useTransform(x, [24, DECIDE_OFFSET], [0, 1])
  const passOpacity = useTransform(x, [-DECIDE_OFFSET, -24], [1, 0])
  const [photo, setPhoto] = useState(0)
  const dragging = useRef(false)
  const crossed = useRef(false)

  const onDrag = (_: unknown, info: PanInfo) => {
    const past = Math.abs(info.offset.x) > DECIDE_OFFSET
    // Haptic tick when crossing the threshold (native only; no-op on the web).
    if (past !== crossed.current) {
      crossed.current = past
      if (past) haptics.impact('light')
    }
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    setTimeout(() => (dragging.current = false), 0)
    const { offset, velocity } = info
    if (offset.x > DECIDE_OFFSET || velocity.x > DECIDE_VELOCITY) onDecide('like')
    else if (offset.x < -DECIDE_OFFSET || velocity.x < -DECIDE_VELOCITY) onDecide('pass')
  }

  const showPhoto = (delta: number) => {
    if (dragging.current) return
    setPhoto((p) => Math.min(profile.photos.length - 1, Math.max(0, p + delta)))
  }

  return (
    <motion.article
      aria-label={t('matching.cardLabel', { name: profile.name, age: profile.age })}
      className="absolute inset-0 cursor-grab touch-none overflow-hidden rounded-[1.75rem] bg-surface-raised shadow-[0_24px_60px_rgb(0_0_0/0.55)] select-none active:cursor-grabbing"
      style={{ x, rotate }}
      drag="x"
      dragSnapToOrigin
      dragElastic={0.9}
      onDragStart={() => (dragging.current = true)}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
    >
      <img
        src={profile.photos[photo]}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 size-full object-cover"
      />
      <div className="absolute inset-x-3 top-3 flex gap-1" aria-hidden>
        {profile.photos.map((src, i) => (
          <span
            key={src}
            className={cn(
              'h-1 flex-1 rounded-full',
              i === photo ? 'bg-foreground' : 'bg-foreground/35',
            )}
          />
        ))}
      </div>
      <button
        type="button"
        className="absolute inset-y-0 left-0 w-1/3"
        aria-label={t('matching.prevPhoto')}
        onClick={() => showPhoto(-1)}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 w-1/3"
        aria-label={t('matching.nextPhoto')}
        onClick={() => showPhoto(1)}
      />
      <motion.span
        style={{ opacity: likeOpacity }}
        className="font-display pointer-events-none absolute top-10 left-6 -rotate-12 rounded-xl border-4 border-success px-3 py-1 text-3xl font-black text-success"
      >
        {t('matching.stampLike')}
      </motion.span>
      <motion.span
        style={{ opacity: passOpacity }}
        className="font-display pointer-events-none absolute top-10 right-6 rotate-12 rounded-xl border-4 border-danger px-3 py-1 text-3xl font-black text-danger"
      >
        {t('matching.stampPass')}
      </motion.span>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/85 to-transparent p-5 pt-24">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-3xl font-semibold">
            {profile.name}, <span className="font-normal">{profile.age}</span>
          </h2>
          <Link
            to={`/people/${profile.id}`}
            className="glass pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-full"
            aria-label={t('matching.viewProfile', { name: profile.name })}
          >
            <Info className="size-5" aria-hidden />
          </Link>
        </div>
        <div className="mt-2">
          <ProfileHighlights profile={profile} context={candidate.context} />
        </div>
        {profile.bio && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{profile.bio}</p>
        )}
      </div>
    </motion.article>
  )
}
