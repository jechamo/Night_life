import { Crown, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useEntitlement } from '@/shared/entitlements/use-entitlement'
import { usePaywallState } from '@/shared/flags/use-paywall-state'
import { PhotoImage } from '@/shared/images/PhotoImage'
import { cn } from '@/shared/lib/cn'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { useLikesView } from '../hooks/use-likes-view'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { SparkNotice } from '@/features/premium/components/SparkNotice'

/**
 * "Quién te ha dado like" (PRD 6.6.1, premium `see_likes`). Without the entitlement
 * and with a visible paywall, faces are blurred; the count is never hidden.
 */
export function LikesYouScreen() {
  const { t } = useTranslation()
  const view = useLikesView()
  const people = view.data?.profiles ?? []
  const count = view.data?.count ?? 0
  const { granted } = useEntitlement('see_likes')
  const paywall = usePaywallState()
  const locked = !granted

  return (
    <>
      <ScreenHeader
        title={t('matching.likesYou.title')}
        description={t('matching.likesYou.count', { count })}
        backTo="/tonight"
      />
      <SparkNotice />
      {view.isPending && <Skeleton className="m-4 h-48" />}
      {(view.isError || view.seenError) && (
        <div role="alert" className="px-safe mt-4">
          <p>{t('errors.generic.description')}</p>
          <Button
            variant="outline"
            onClick={() => (view.isError ? void view.refetch() : view.retrySeen())}
          >
            {t('common.retry')}
          </Button>
        </div>
      )}
      {locked && paywall !== 'hidden' && (
        <Link
          to="/premium"
          className="glass mx-4 mt-4 flex items-center gap-2 rounded-2xl p-3 text-sm transition-opacity active:opacity-70"
        >
          <Crown className="size-5 shrink-0 text-warning" aria-hidden />
          <span className="flex-1">
            {paywall === 'checkout'
              ? t('matching.likesYou.premium')
              : t('matching.limit.comingSoon')}
          </span>
          <span className="font-semibold text-primary">{t('premium.seePlans')}</span>
        </Link>
      )}
      <ul className="px-safe mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {(locked
          ? Array.from({ length: Math.min(count, 50) }, (_, i) => ({
              id: `locked-${i}`,
              name: '',
              age: 0,
              photos: [] as string[],
            }))
          : people
        ).map((person) => (
          <li
            key={person.id}
            className="relative aspect-[3/4] overflow-hidden rounded-theme bg-surface-raised"
          >
            <PhotoImage
              src={person.photos[0]}
              sizes="(min-width: 640px) 30vw, 45vw"
              alt={locked ? '' : person.name}
              className={cn('size-full object-cover', locked && 'scale-110 blur-xl')}
            />
            {locked ? (
              <span
                className="absolute inset-0 flex items-center justify-center"
                aria-label={t('matching.likesYou.hidden')}
              >
                <Lock className="size-6" aria-hidden />
              </span>
            ) : (
              <Link
                to={`/people/${person.id}`}
                className="absolute inset-x-0 bottom-0 bg-background/95 p-3 font-semibold"
              >
                {person.name}, {person.age}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
