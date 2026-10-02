import { Flag, Hand, MapPin, Users, Vote } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ACCENT_KEYS, type AccentKey } from '@/shared/domain/venue-types'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Chip } from '@/shared/ui/chip'
import { Section } from '@/shared/ui/section'
import { SegmentedControl } from '@/shared/ui/segmented-control'
import { Skeleton } from '@/shared/ui/skeleton'

export function ButtonsDemo() {
  const { t } = useTranslation()
  return (
    <Section title={t('designKit.sections.buttons')}>
      <div className="flex flex-wrap gap-3">
        <Button>
          <MapPin aria-hidden />
          {t('designKit.buttons.primary')}
        </Button>
        <Button variant="secondary">
          <Hand aria-hidden />
          {t('designKit.buttons.secondary')}
        </Button>
        <Button variant="glass">
          <Users aria-hidden />
          {t('designKit.buttons.glass')}
        </Button>
        <Button variant="outline">
          <Vote aria-hidden />
          {t('designKit.buttons.ghost')}
        </Button>
        <Button variant="danger" size="sm">
          <Flag aria-hidden />
          {t('designKit.buttons.danger')}
        </Button>
      </div>
    </Section>
  )
}

export function ChipsDemo() {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<ReadonlySet<AccentKey>>(new Set(['nightclub']))
  const toggle = (key: AccentKey) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  return (
    <Section title={t('designKit.sections.chips')}>
      <div className="flex flex-wrap gap-2">
        {ACCENT_KEYS.map((key) => (
          <Chip key={key} accent={key} selected={selected.has(key)} onClick={() => toggle(key)}>
            {t(`venueTypes.${key}`)}
          </Chip>
        ))}
      </div>
    </Section>
  )
}

export function BadgesDemo() {
  const { t } = useTranslation()
  const [replay, setReplay] = useState(0)
  return (
    <Section title={t('designKit.sections.badges')}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="touch-target inline-flex items-center"
          onClick={() => setReplay((n) => n + 1)}
        >
          <Badge key={replay} tone="verified" stampIn>
            {t('badges.verified')}
          </Badge>
        </button>
        <Badge tone="live">{t('badges.live')}</Badge>
        <Badge tone="hereNow">{t('badges.hereNow')}</Badge>
        <Badge tone="sponsored">{t('badges.sponsored')}</Badge>
        <Badge tone="unconfirmed">{t('badges.unconfirmed')}</Badge>
      </div>
    </Section>
  )
}

type Scope = 'all' | 'venues' | 'events'

export function SegmentedDemo() {
  const { t } = useTranslation()
  const [scope, setScope] = useState<Scope>('all')
  return (
    <Section title={t('designKit.sections.segmented')}>
      <SegmentedControl<Scope>
        label={t('designKit.segmented.label')}
        value={scope}
        onChange={setScope}
        options={[
          { value: 'all', label: t('designKit.segmented.all') },
          { value: 'venues', label: t('designKit.segmented.venues') },
          { value: 'events', label: t('designKit.segmented.events') },
        ]}
      />
    </Section>
  )
}

export function SkeletonDemo() {
  const { t } = useTranslation()
  return (
    <Section title={t('designKit.sections.skeletons')}>
      <div className="flex items-center gap-3">
        <Skeleton className="size-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
    </Section>
  )
}
