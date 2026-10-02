import { BadgeCheck, MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/shared/ui/badge'
import type { Candidate, PublicProfile } from '../model/people'
import { AnthemChip } from './AnthemChip'

/** Context signals (PRD 6.6.1): "Aquí Ahora", common place, friendship-only, Anthem. */
export function ProfileHighlights({
  profile,
  context,
}: {
  profile: PublicProfile
  context?: Candidate['context']
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {context?.sameVenueNow && <Badge tone="hereNow">{t('badges.hereNow')}</Badge>}
      {context?.venueName && !context.sameVenueNow && (
        <span className="glass font-label inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs">
          <MapPin className="size-3.5 text-primary" aria-hidden />
          {t('matching.commonPlace', { place: context.venueName })}
        </span>
      )}
      {profile.photoVerified && (
        <Badge tone="verified">
          <BadgeCheck className="sr-only" aria-hidden />
          {t('badges.verified')}
        </Badge>
      )}
      {profile.trafficLight === 'yellow' && (
        <Badge tone="unconfirmed">{t('matching.friendshipOnly')}</Badge>
      )}
      {profile.anthem && <AnthemChip anthem={profile.anthem} />}
    </div>
  )
}
