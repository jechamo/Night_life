import { useQuery, useQueryClient } from '@tanstack/react-query'
import { SearchCheck } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { PlaceCard } from '@/features/places/components/PlaceCard'
import { usePlaces } from '@/features/places/hooks/use-places'
import { useVerificationSnapshot } from '@/features/verification/hooks/use-verification'
import { canPerform } from '@/features/verification/model/verification'
import { MOCK_CENTER } from '@/mocks/world/places.mock'
import { useEntitlement } from '@/shared/entitlements/use-entitlement'
import { newPeopleKey, type NewPeopleNotice } from '@/shared/realtime/RealtimeBridge'
import { ButtonLink } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Skeleton } from '@/shared/ui/skeleton'
import { Switch } from '@/shared/ui/switch'
import { LikeLimitSheet } from '../components/LikeLimitSheet'
import { LiveNotice } from '../components/LiveNotice'
import { useMatchCelebration } from '../components/MatchCelebration'
import { SwipeDeck } from '../components/SwipeDeck'
import { useCandidates, useLikesLeft, useSwipeActions } from '../hooks/use-matching'

/** Swipe for one place (or everyone around). Guarded: needs verified age (PRD 5.2.10). */
export function SwipeScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { placeId = null } = useParams()
  const { data: places = [] } = usePlaces()
  const { data: verification } = useVerificationSnapshot()
  const place = places.find((p) => p.id === placeId)
  const [onlyVerified, setOnlyVerified] = useState(false)
  const switchId = useId()
  const candidates = useCandidates(placeId, onlyVerified)
  const { like, pass, undo } = useSwipeActions()
  const { remaining, unlimited } = useLikesLeft()
  const canUndo = useEntitlement('undo').granted
  const { celebrate } = useMatchCelebration()
  const [limitOpen, setLimitOpen] = useState(false)
  const { data: notice } = useQuery<NewPeopleNotice | null>({
    queryKey: newPeopleKey,
    queryFn: () => null,
    staleTime: Infinity,
  })
  const [dismissedAt, setDismissedAt] = useState(0)
  const noticePlace = places.find((p) => p.id === notice?.placeId)
  const showNotice = notice && noticePlace && notice.at > dismissedAt

  if (!verification) return <Skeleton className="m-4 h-96" />
  if (!canPerform('view_profiles', verification)) {
    return (
      <>
        <ScreenHeader title={t('tabs.tonight')} backTo="/tonight" />
        <EmptyState
          icon={SearchCheck}
          title={t('verification.gate.title')}
          description={t('verification.gate.body', {
            action: t('verification.gate.actions.view_profiles'),
          })}
          action={
            <ButtonLink to="/verification/age">{t('verification.gate.verifyNow')}</ButtonLink>
          }
        />
      </>
    )
  }

  const nearby = places
    .filter((p) => p.id !== placeId && p.stats.people >= 5)
    .sort((a, b) => b.stats.people - a.stats.people)
    .slice(0, 3)

  return (
    <div className="relative flex min-h-[calc(100dvh-8rem)] flex-col">
      <ScreenHeader
        title={place?.name ?? t('matching.everyone')}
        backTo="/tonight"
        description={
          unlimited ? t('matching.likesUnlimited') : t('matching.likesLeft', { count: remaining })
        }
      />
      <LiveNotice
        text={
          showNotice
            ? t('matching.notice.newPeople', { count: notice.count, place: noticePlace.name })
            : null
        }
        onView={() => {
          setDismissedAt(notice?.at ?? 0)
          void queryClient.invalidateQueries({ queryKey: ['matching', 'candidates'] })
        }}
      />
      <div className="px-safe mt-3 flex items-center justify-end gap-2">
        <label htmlFor={switchId} className="text-sm">
          {t('matching.onlyVerified')}
        </label>
        <Switch id={switchId} checked={onlyVerified} onCheckedChange={setOnlyVerified} />
      </div>
      <div className="px-safe mt-3 flex flex-1 flex-col pb-4">
        {candidates.isPending ? (
          <Skeleton className="mx-auto aspect-[3/4] w-full max-w-sm" />
        ) : (
          <SwipeDeck
            key={`${placeId}-${onlyVerified}`}
            candidates={candidates.data ?? []}
            canUndo={canUndo}
            onLike={async (candidate) => {
              const result = await like.mutateAsync(candidate.profile.id)
              if (!result.ok) {
                setLimitOpen(true)
                return 'limit'
              }
              if (result.value.match) celebrate(result.value.match)
              return 'ok'
            }}
            onPass={(candidate) => pass.mutate(candidate.profile.id)}
            onUndo={async () => (await undo.mutateAsync()).ok}
            empty={
              <div>
                <EmptyState
                  icon={SearchCheck}
                  illustration="emptySeenAll"
                  title={t('matching.empty.title')}
                  description={t('matching.empty.body')}
                />
                <ul className="space-y-2">
                  {nearby.map((p) => (
                    <li key={p.id}>
                      <PlaceCard
                        place={p}
                        origin={MOCK_CENTER}
                        onSelect={(id) => void navigate(`/tonight/swipe/${id}`)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            }
          />
        )}
      </div>
      <LikeLimitSheet open={limitOpen} onClose={() => setLimitOpen(false)} />
    </div>
  )
}
