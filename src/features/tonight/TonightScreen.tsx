import { Heart, MapPinCheck, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useAttendance } from '@/features/attendance/hooks/use-attendance'
import { useLikesYou } from '@/features/matching/hooks/use-matching'
import { PlaceCard } from '@/features/places/components/PlaceCard'
import { usePlaces } from '@/features/places/hooks/use-places'
import type { Place } from '@/features/places/model/types'
import { useAgeGate } from '@/features/verification/hooks/use-age-gate'
import { MOCK_CENTER } from '@/mocks/world/places.mock'
import { Button, ButtonLink } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Section } from '@/shared/ui/section'
import { SegmentedControl } from '@/shared/ui/segmented-control'

type Mode = 'here' | 'tonight'

/** Esta Noche (PRD 5.3): "Aquí Ahora" / "Esta Noche Voy" and the way into the swipe. */
export function TonightScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { guard } = useAgeGate()
  const [mode, setMode] = useState<Mode>('here')
  const { data: attendance } = useAttendance()
  const { data: places = [] } = usePlaces()
  const { data: likesYou = [] } = useLikesYou()

  const open = (placeId: string | null) => {
    if (guard('view_profiles'))
      void navigate(placeId ? `/tonight/swipe/${placeId}` : '/tonight/swipe')
  }
  const mine = places.find(
    (p) => p.id === (mode === 'here' ? attendance?.checkIn?.placeId : attendance?.going?.placeId),
  )
  const ranked = [...places]
    .filter((p) => (mode === 'here' ? p.stats.people > 0 : p.stats.goingTonight > 0))
    .sort((a, b) =>
      mode === 'here'
        ? b.stats.people - a.stats.people
        : b.stats.goingTonight - a.stats.goingTonight,
    )
    .slice(0, 6)

  const card = (place: Place) => (
    <PlaceCard
      key={place.id}
      place={place}
      origin={MOCK_CENTER}
      layoutId={`place-${place.id}`}
      onSelect={open}
    />
  )

  return (
    <>
      <ScreenHeader
        title={t('tabs.tonight')}
        trailing={
          <ButtonLink
            to="/tonight/likes"
            variant="glass"
            size="sm"
            aria-label={t('matching.likesYou.title')}
          >
            <Heart className="text-accent-event" aria-hidden />
            {likesYou.length}
          </ButtonLink>
        }
      />
      <div className="px-safe mt-2">
        <SegmentedControl<Mode>
          label={t('tabs.tonight')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'here', label: t('matching.modes.here') },
            { value: 'tonight', label: t('matching.modes.tonight') },
          ]}
        />
      </div>
      {mine ? (
        <Section title={mode === 'here' ? t('matching.youAreHere') : t('matching.youAreGoing')}>
          {card(mine)}
          <Button block className="mt-3" onClick={() => open(mine.id)}>
            <Users aria-hidden />
            {t('tonightPreview.viewProfiles')}
          </Button>
        </Section>
      ) : (
        <EmptyState
          icon={mode === 'here' ? MapPinCheck : Heart}
          title={mode === 'here' ? t('matching.noCheckIn.title') : t('matching.noGoing.title')}
          description={mode === 'here' ? t('matching.noCheckIn.body') : t('matching.noGoing.body')}
          action={
            <Button onClick={() => open(null)}>
              <Users aria-hidden />
              {t('tonightPreview.viewProfiles')}
            </Button>
          }
        />
      )}
      <Section title={mode === 'here' ? t('matching.liveNow') : t('matching.goingTonightList')}>
        <ul className="space-y-2">
          {ranked.map((place) => (
            <li key={place.id}>{card(place)}</li>
          ))}
        </ul>
      </Section>
    </>
  )
}
