import { EyeOff } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { AnthemChip } from '@/features/matching/components/AnthemChip'
import type { TrafficLight } from '@/features/matching/model/people'
import { useVerificationSnapshot } from '@/features/verification/hooks/use-verification'
import { PhotoImage } from '@/shared/images/PhotoImage'
import { cn } from '@/shared/lib/cn'
import { Badge } from '@/shared/ui/badge'
import { GlassCard } from '@/shared/ui/card'
import { Switch } from '@/shared/ui/switch'
import { useMyProfile, useUpdateProfile } from '../use-my-profile'

const LIGHTS: readonly { value: TrafficLight; dot: string }[] = [
  { value: 'green', dot: 'bg-success' },
  { value: 'yellow', dot: 'bg-warning' },
  { value: 'red', dot: 'bg-danger' },
]

/** My profile summary + traffic light + discreet mode (PRD 5.3, 6.6, 4.3). */
export function MyProfileCard() {
  const { t } = useTranslation()
  const { data: me } = useMyProfile()
  const { data: verification } = useVerificationSnapshot()
  const update = useUpdateProfile()
  const discreetId = useId()
  if (!me) return null

  return (
    <div className="px-safe mt-4 space-y-3">
      <GlassCard className="flex items-center gap-4">
        <PhotoImage
          src={me.photos[0]}
          sizes="80px"
          alt=""
          className="size-20 rounded-full border-2 border-primary object-cover"
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-xl font-semibold">
            {me.name}, {me.age}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {verification?.age.state === 'verified' && (
              <Badge tone="verified">{t('profileMenu.ageVerified')}</Badge>
            )}
            {verification?.photo.state === 'verified' && (
              <Badge tone="verified">{t('badges.verified')}</Badge>
            )}
          </div>
          {me.anthem && <AnthemChip anthem={me.anthem} />}
        </div>
      </GlassCard>
      <GlassCard className="space-y-3">
        <p className="font-medium">{t('profileMenu.trafficLight.title')}</p>
        <div
          role="radiogroup"
          aria-label={t('profileMenu.trafficLight.title')}
          className="grid grid-cols-3 gap-2"
        >
          {LIGHTS.map(({ value, dot }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={me.trafficLight === value}
              onClick={() => update.mutate({ trafficLight: value })}
              className={cn(
                'touch-target flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-sm transition-opacity',
                me.trafficLight === value ? 'border-primary bg-surface-raised' : 'border-border',
              )}
            >
              <span className={cn('size-4 rounded-full', dot)} aria-hidden />
              {t(`profileMenu.trafficLight.${value}`)}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {t(`profileMenu.trafficLight.${me.trafficLight}Hint`)}
        </p>
        <div className="flex items-center gap-3 border-t border-border pt-3">
          <EyeOff className="size-5 text-primary" aria-hidden />
          <label htmlFor={discreetId} className="flex-1">
            <span className="block font-medium">{t('profileMenu.discreet.title')}</span>
            <span className="block text-sm text-muted-foreground">
              {t('profileMenu.discreet.body')}
            </span>
          </label>
          <Switch
            id={discreetId}
            checked={me.discreet}
            onCheckedChange={(discreet) => update.mutate({ discreet })}
          />
        </div>
      </GlassCard>
    </div>
  )
}
