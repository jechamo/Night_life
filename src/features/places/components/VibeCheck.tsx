import { Coffee, Flame, Music, Smile, Users, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/cn'
import { useMyVibe, useVoteVibe } from '../hooks/use-places'
import { vibeShares } from '../model/stats'
import { VIBES, type Place, type Vibe } from '../model/types'

const ICONS: Record<Vibe, LucideIcon> = {
  fire: Flame,
  music: Music,
  chill: Coffee,
  packed: Users,
  friendly: Smile,
}

/** Vibe Check (PRD 6.8): needs an active check-in here, vote can change, shown aggregated. */
export function VibeCheck({ place, checkedInHere }: { place: Place; checkedInHere: boolean }) {
  const { t } = useTranslation()
  const { data: mine } = useMyVibe(place.id)
  const vote = useVoteVibe(place.id)
  const shares = vibeShares(place.vibes)
  return (
    <section id="vibe-check" aria-labelledby="vibe-title" className="space-y-3">
      <h3 id="vibe-title" className="text-lg font-semibold">
        {t('places.vibe.title')}
      </h3>
      {shares.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('places.vibe.noVotes')}</p>
      ) : (
        <ul className="space-y-1.5">
          {shares.slice(0, 3).map(({ key, percent }) => {
            const Icon = ICONS[key]
            return (
              <li key={key} className="flex items-center gap-2 text-sm">
                <Icon className="size-4 text-primary" aria-hidden />
                <span className="w-28">{t(`places.vibe.options.${key}`)}</span>
                <span
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised"
                  aria-hidden
                >
                  <span
                    className="block h-full origin-left rounded-full bg-primary"
                    style={{ transform: `scaleX(${percent / 100})` }}
                  />
                </span>
                <span className="font-label w-10 text-right text-xs">{percent}%</span>
              </li>
            )
          })}
        </ul>
      )}
      <div role="group" aria-label={t('places.vibe.vote')} className="flex flex-wrap gap-2">
        {VIBES.map((vibe) => {
          const Icon = ICONS[vibe]
          return (
            <button
              key={vibe}
              type="button"
              disabled={!checkedInHere || vote.isPending}
              aria-pressed={mine === vibe}
              onClick={() => vote.mutate(vibe)}
              className={cn(
                'touch-target font-label inline-flex items-center gap-1.5 rounded-full border px-3 text-sm transition-opacity disabled:opacity-50',
                mine === vibe
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-surface',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t(`places.vibe.options.${vibe}`)}
            </button>
          )
        })}
      </div>
      {!checkedInHere && (
        <p className="text-xs text-muted-foreground">{t('places.vibe.needsCheckIn')}</p>
      )}
    </section>
  )
}
