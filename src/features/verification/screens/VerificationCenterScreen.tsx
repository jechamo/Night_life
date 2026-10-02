import { CalendarCheck, Camera, IdCard, Smartphone, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { Illustration } from '@/shared/images/Illustration'
import { Badge } from '@/shared/ui/badge'
import { Button, ButtonLink } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Skeleton } from '@/shared/ui/skeleton'
import { VerificationStatusBadge } from '../components/VerificationStatusBadge'
import { useRequestHumanReview, useVerificationSnapshot } from '../hooks/use-verification'
import type { VerificationLevel, VerificationStatus } from '../model/verification'

const LEVELS: readonly { level: VerificationLevel; icon: LucideIcon; required: boolean }[] = [
  { level: 'age', icon: CalendarCheck, required: true },
  { level: 'photo', icon: Camera, required: false },
  { level: 'identity', icon: IdCard, required: false },
]
const RESULTS = ['verified', 'manual_review', 'failed', 'pending'] as const
type ResultKey = (typeof RESULTS)[number]

function LevelAction({ level, status }: { level: VerificationLevel; status: VerificationStatus }) {
  const { t } = useTranslation()
  const review = useRequestHumanReview()
  const to = `/verification/${level}`
  switch (status.state) {
    case 'not_started':
      return (
        <ButtonLink to={to} size="sm">
          {t('verification.actions.start')}
        </ButtonLink>
      )
    case 'pending':
      return (
        <ButtonLink to={`/verification/sandbox?level=${level}`} size="sm" variant="outline">
          {t('verification.actions.continuePending')}
        </ButtonLink>
      )
    case 'failed':
      return (
        <div className="flex flex-wrap gap-2">
          {status.canRequestReview && (
            <Button
              size="sm"
              variant="outline"
              disabled={review.isPending}
              onClick={() => review.mutate(level)}
            >
              {t('verification.actions.requestReview')}
            </Button>
          )}
          <ButtonLink to={to} size="sm">
            {t('verification.actions.retry')}
          </ButtonLink>
        </div>
      )
    case 'reverification_required':
      return (
        <ButtonLink to={to} size="sm">
          {t('verification.actions.retry')}
        </ButtonLink>
      )
    default:
      return null
  }
}

/** Verification centre (PRD 5.1, 6.2): levels 0-3 with their simulated states. */
export function VerificationCenterScreen() {
  const { t } = useTranslation()
  const { data: snapshot } = useVerificationSnapshot()
  const [params] = useSearchParams()
  const result = params.get('result')
  const banner = (RESULTS as readonly string[]).includes(result ?? '')
    ? (result as ResultKey)
    : null

  return (
    <>
      <ScreenHeader
        title={t('verification.center.title')}
        description={t('verification.center.description')}
        backTo="/profile"
      />
      <div className="px-safe mt-6 space-y-3">
        {banner && (
          <p role="status" className="glass rounded-2xl px-4 py-3 font-medium text-live">
            {t(`verification.result.${banner}`)}
          </p>
        )}
        <GlassCard className="flex items-start gap-3">
          <Smartphone className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="flex-1">
            <p className="font-medium">{t('verification.levels.phone.title')}</p>
            <p className="text-sm text-muted-foreground">
              {t('verification.levels.phone.description')}
            </p>
          </div>
          <Badge tone="verified">{t('verification.states.verified')}</Badge>
        </GlassCard>
        {!snapshot && <Skeleton className="h-28" />}
        {snapshot &&
          LEVELS.map(({ level, icon: Icon, required }) => (
            <GlassCard key={level} className="space-y-3">
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <div className="flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {t(`verification.levels.${level}.title`)}
                    <span className="font-label text-xs text-muted-foreground">
                      {required ? t('common.required') : t('common.optional')}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t(`verification.levels.${level}.description`)}
                  </p>
                </div>
                <VerificationStatusBadge status={snapshot[level]} />
              </div>
              <LevelAction level={level} status={snapshot[level]} />
            </GlassCard>
          ))}
        <div className="flex items-center gap-3 pt-2">
          <Illustration name="verification" className="size-20 shrink-0" />
          <p className="text-sm text-muted-foreground">{t('verification.center.neverStored')}</p>
        </div>
      </div>
    </>
  )
}
