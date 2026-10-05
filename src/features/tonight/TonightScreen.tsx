import { Heart, MapPinCheck, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAttendance } from '@/features/attendance/hooks/use-attendance'
import { useLikesYouCount, useMatches } from '@/features/matching/hooks/use-matching'
import { useVerificationSnapshot } from '@/features/verification/hooks/use-verification'
import { isAgeVerified } from '@/features/verification/model/verification'
import { PhotoImage } from '@/shared/images/PhotoImage'
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
import { SparkNotice } from '@/features/premium/components/SparkNotice'

type Mode = 'here' | 'tonight'

/** Esta Noche (PRD 5.3): "Aquí Ahora" / "Esta Noche Voy" and the way into the swipe. */
export function TonightScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { guard } = useAgeGate()
  const [mode, setMode] = useState<Mode>('here')
  const { data: attendance } = useAttendance()
  const { data: places = [] } = usePlaces()
  const { data: likesYouCount = 0 } = useLikesYouCount()
  const { data: verification } = useVerificationSnapshot()
  const verified = verification != null && isAgeVerified(verification)
  const { data: matches = [] } = useMatches(verified)
  const { hash } = useLocation()
  useEffect(() => {
    if (hash === '#matches' && verified) document.getElementById('matches')?.scrollIntoView()
  }, [hash, verified, matches.length])

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
      <SparkNotice />
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
            {likesYouCount}
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
      {verified && (
        <section id="matches" className="scroll-mt-4">
          <Section title={t('home.matches')}>
            <ul className="flex flex-wrap gap-4">
              {matches.slice(0, 6).map((match) => (
                <li key={match.id}>
                  <Link to={`/chats/${match.id}`} className="flex w-20 flex-col items-center gap-2">
                    <PhotoImage
                      src={match.person.photos[0]}
                      alt=""
                      sizes="64px"
                      className="size-16 rounded-full border-2 border-primary object-cover"
                    />
                    <span className="max-w-full truncate text-sm">{match.person.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <ButtonLink to="/chats" variant="ghost" className="mt-3">
              {t('tabs.chats')}
            </ButtonLink>
          </Section>
        </section>
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
