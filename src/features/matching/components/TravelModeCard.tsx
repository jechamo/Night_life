import { Plane } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CITIES } from '@/features/places/model/cities'
import { Button, ButtonLink } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { SingleChoice } from '@/shared/ui/choice-group'
import { Section } from '@/shared/ui/section'
import { useTravelMode } from '../hooks/use-travel'

const DAYS = ['3', '7', '14', '30'] as const

/**
 * Block 11b: travel mode (Pass benefit). Appear in and explore another launch city's swipe
 * before arriving; the real city is never shown. Flag, benefit and limits are server-side.
 */
export function TravelModeCard() {
  const { t, i18n } = useTranslation()
  const { enabled, state, start, stop } = useTravelMode()
  const [city, setCity] = useState<string | undefined>()
  const [days, setDays] = useState<(typeof DAYS)[number]>('7')
  if (!enabled || !state.data?.enabled) return null
  const travel = state.data
  const result = start.data
  const error =
    start.isError || stop.isError ? 'network' : result && !result.ok ? result.error : null
  const options = CITIES.filter((c) => c.name !== travel.homeCity).map((c) => ({
    value: c.name,
    label: c.name,
  }))

  return (
    <Section title={t('travel.title')}>
      <GlassCard className="space-y-3">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Plane className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          {t('travel.description')}
        </p>
        {!travel.entitled ? (
          <>
            <p className="text-sm">{t('travel.upsell')}</p>
            <ButtonLink to="/premium" size="sm">
              {t('travel.seePremium')}
            </ButtonLink>
          </>
        ) : travel.active && travel.city && travel.endsAt ? (
          <>
            <p role="status" className="font-medium text-live">
              {t('travel.active', {
                city: travel.city,
                date: new Date(travel.endsAt).toLocaleDateString(i18n.language),
              })}
            </p>
            <Button variant="outline" block disabled={stop.isPending} onClick={() => stop.mutate()}>
              {t('travel.stop', { city: travel.homeCity ?? '' })}
            </Button>
          </>
        ) : (
          <>
            <SingleChoice
              label={t('travel.city')}
              value={city}
              options={options}
              onChange={setCity}
            />
            <SingleChoice
              label={t('travel.days')}
              value={days}
              options={DAYS.map((value) => ({
                value,
                label: t('travel.daysValue', { count: Number(value) }),
              }))}
              onChange={setDays}
            />
            <Button
              block
              disabled={!city || start.isPending}
              onClick={() => city && start.mutate({ city, days: Number(days) })}
            >
              {t('travel.activate')}
            </Button>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {t(`travel.errors.${error}`)}
          </p>
        )}
      </GlassCard>
    </Section>
  )
}
