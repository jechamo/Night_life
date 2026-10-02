import { Crown, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useEntitlement } from '@/shared/entitlements/use-entitlement'
import { usePaywallState } from '@/shared/flags/use-paywall-state'
import { cn } from '@/shared/lib/cn'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { useLikesYou } from '../hooks/use-matching'

/**
 * "Quién te ha dado like" (PRD 6.6.1, premium `see_likes`). Without the entitlement
 * and with a visible paywall, faces are blurred; the count is never hidden.
 */
export function LikesYouScreen() {
  const { t } = useTranslation()
  const { data: people = [] } = useLikesYou()
  const { granted } = useEntitlement('see_likes')
  const paywall = usePaywallState()
  const locked = !granted

  return (
    <>
      <ScreenHeader
        title={t('matching.likesYou.title')}
        description={t('matching.likesYou.count', { count: people.length })}
        backTo="/tonight"
      />
      {locked && paywall !== 'hidden' && (
        <p className="glass mx-4 mt-4 flex items-center gap-2 rounded-2xl p-3 text-sm">
          <Crown className="size-5 shrink-0 text-warning" aria-hidden />
          {paywall === 'checkout' ? t('matching.likesYou.premium') : t('matching.limit.comingSoon')}
        </p>
      )}
      <ul className="px-safe mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {people.map((person) => (
          <li
            key={person.id}
            className="relative aspect-[3/4] overflow-hidden rounded-theme bg-surface-raised"
          >
            <img
              src={person.photos[0]}
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
                className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background to-transparent p-3 font-semibold"
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
