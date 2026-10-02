import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SAMPLE_VENUE } from '@/mocks/design-kit.mock'
import { AnimatedCounter } from '@/shared/ui/animated-counter'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { Section } from '@/shared/ui/section'

/** "Quién hay" preview with counters that count (real thresholds of PRD 4.3 arrive in Block 3). */
export function LiveStatsDemo() {
  const { t } = useTranslation()
  const [people, setPeople] = useState(SAMPLE_VENUE.people)
  return (
    <Section title={t('designKit.sections.live')}>
      <GlassCard>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">{SAMPLE_VENUE.name}</h3>
          <Badge tone="live">{t('badges.live')}</Badge>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label={t('designKit.stats.people')}>
            <AnimatedCounter value={people} />
          </Stat>
          <Stat label={t('designKit.stats.averageAge')}>
            <AnimatedCounter value={SAMPLE_VENUE.averageAge} />
          </Stat>
          <Stat label={t('designKit.stats.green')}>
            <AnimatedCounter value={SAMPLE_VENUE.greenPercent} format={(n) => `${n}%`} />
          </Stat>
        </dl>
        <Button
          variant="glass"
          size="sm"
          block
          className="mt-4"
          onClick={() => setPeople((n) => n + 3)}
        >
          <UserPlus aria-hidden />
          {t('designKit.stats.simulate')}
        </Button>
      </GlassCard>
    </Section>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-raised px-2 py-3">
      <dd className="font-display text-3xl font-semibold text-primary">{children}</dd>
      <dt className="font-label mt-1 text-xs text-muted-foreground">{label}</dt>
    </div>
  )
}
