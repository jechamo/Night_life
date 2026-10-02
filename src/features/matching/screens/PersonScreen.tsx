import { Ban, Flag, SearchCheck, Send } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { PaidDmSheet } from '@/features/premium/components/PaidDmSheet'
import { useVerificationSnapshot } from '@/features/verification/hooks/use-verification'
import { canPerform } from '@/features/verification/model/verification'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'
import { Button, ButtonLink } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Skeleton } from '@/shared/ui/skeleton'
import { ProfileHighlights } from '../components/ProfileHighlights'
import { SafetySheet, type SafetyAction } from '../components/SafetySheet'
import { usePerson } from '../hooks/use-matching'

/** Another person's public profile (PRD 5.1). Never shows exact location or check-in time. */
export function PersonScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { personId = '' } = useParams()
  const { data: verification } = useVerificationSnapshot()
  const { data: person, isPending } = usePerson(personId)
  const [action, setAction] = useState<SafetyAction | null>(null)
  const [dmOpen, setDmOpen] = useState(false)
  const paidDm = useFeatureFlag('paid_dm_enabled')

  if (!verification || isPending) return <Skeleton className="m-4 h-96" />
  if (!canPerform('view_profiles', verification)) {
    return (
      <EmptyState
        icon={SearchCheck}
        title={t('verification.gate.title')}
        description={t('verification.gate.body', {
          action: t('verification.gate.actions.view_profiles'),
        })}
        action={<ButtonLink to="/verification/age">{t('verification.gate.verifyNow')}</ButtonLink>}
      />
    )
  }
  if (!person)
    return <EmptyState icon={SearchCheck} title={t('safety.unavailable')} description="" />

  return (
    <>
      <ScreenHeader title={`${person.name}, ${person.age}`} backTo="/tonight" />
      <div className="px-safe mt-4 space-y-4 pb-6">
        <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 [scrollbar-width:none]">
          {person.photos.map((src, i) => (
            <li
              key={src}
              className="aspect-[3/4] w-[80%] shrink-0 snap-center overflow-hidden rounded-theme bg-surface-raised"
            >
              <img
                src={src}
                alt={t('onboarding.profile.photoAlt', { n: i + 1 })}
                className="size-full object-cover"
              />
            </li>
          ))}
        </ul>
        <ProfileHighlights profile={person} />
        {person.bio && <p className="leading-relaxed">{person.bio}</p>}
        {paidDm === 'on' && (
          <Button block variant="glass" onClick={() => setDmOpen(true)}>
            <Send aria-hidden />
            {t('premium.paidDm.cta')}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => setAction('report')}>
            <Flag aria-hidden />
            {t('safety.report.cta')}
          </Button>
          <Button variant="outline" onClick={() => setAction('block')}>
            <Ban aria-hidden />
            {t('safety.block.cta')}
          </Button>
        </div>
      </div>
      <PaidDmSheet
        open={dmOpen}
        personId={person.id}
        name={person.name}
        onClose={() => setDmOpen(false)}
      />
      <SafetySheet
        action={action}
        personId={person.id}
        personName={person.name}
        onClose={() => setAction(null)}
        onDone={(done) => {
          setAction(null)
          if (done === 'block') void navigate('/tonight', { replace: true })
        }}
      />
    </>
  )
}
