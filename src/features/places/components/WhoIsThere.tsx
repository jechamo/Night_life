import { useTranslation } from 'react-i18next'
import { AnimatedCounter } from '@/shared/ui/animated-counter'
import { LivePulse } from '@/shared/ui/live-pulse'
import { presentStats } from '../model/stats'
import type { PlaceStats } from '../model/types'

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-raised px-2 py-3 text-center">
      <dd className="font-display text-2xl font-semibold text-primary">{children}</dd>
      <dt className="font-label mt-0.5 text-xs text-muted-foreground">{label}</dt>
    </div>
  )
}

/** "Quién hay" (PRD 5.3, 4.3): live counters with privacy thresholds applied. */
export function WhoIsThere({ stats }: { stats: PlaceStats }) {
  const { t } = useTranslation()
  const shown = presentStats(stats)
  return (
    <section aria-labelledby="who-is-there" className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 id="who-is-there" className="text-lg font-semibold">
          {t('places.whoIsThere')}
        </h3>
        <span className="font-label inline-flex items-center gap-1.5 text-xs text-live">
          <LivePulse className="size-2" />
          {t('badges.live')}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <Stat label={t('places.people')}>
          {shown.people.kind === 'exact' ? (
            <AnimatedCounter value={shown.people.value} />
          ) : (
            t('places.lessThan', { count: shown.people.value })
          )}
        </Stat>
        <Stat label={t('places.averageAge')}>
          {shown.averageAge !== null ? <AnimatedCounter value={shown.averageAge} /> : '—'}
        </Stat>
        <Stat label={t('places.green')}>
          {shown.greenPercent !== null ? (
            <AnimatedCounter value={shown.greenPercent} format={(n) => `${n}%`} />
          ) : (
            '—'
          )}
        </Stat>
      </dl>
      {shown.ratio && (
        <div>
          <div className="flex h-2 overflow-hidden rounded-full bg-surface-raised" aria-hidden>
            <span className="bg-accent-event" style={{ width: `${shown.ratio.women}%` }} />
            <span className="bg-secondary" style={{ width: `${shown.ratio.men}%` }} />
            <span className="bg-warning" style={{ width: `${shown.ratio.other}%` }} />
          </div>
          <p className="font-label mt-1.5 text-xs text-muted-foreground">
            {t('places.ratio', {
              women: shown.ratio.women,
              men: shown.ratio.men,
              other: shown.ratio.other,
            })}
          </p>
        </div>
      )}
      {shown.people.kind === 'less_than' && (
        <p className="text-xs text-muted-foreground">{t('places.privacyNote')}</p>
      )}
      <p className="text-sm">
        <AnimatedCounter value={shown.goingTonight} className="font-semibold text-primary" />{' '}
        {t('places.goingTonight')}
      </p>
    </section>
  )
}
