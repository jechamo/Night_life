import { Hand, MapPin, MapPinCheck, Package, Users, Vote } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import {
  useAttendance,
  useCheckIn,
  useCheckOut,
  useGoingTonight,
} from '@/features/attendance/hooks/use-attendance'
import { useAgeGate } from '@/features/verification/hooks/use-age-gate'
import { useVerificationSnapshot } from '@/features/verification/hooks/use-verification'
import { isAgeVerified } from '@/features/verification/model/verification'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'
import { Button } from '@/shared/ui/button'
import type { Place } from '../model/types'
import { CheckInCelebration } from './CheckInCelebration'

/** Place actions (PRD 5.3): Esta Noche Voy, Estoy Aquí, Ver perfiles, Votar, Objetos perdidos. */
export function PlaceActions({
  place,
  onToggleLostFound,
}: {
  place: Place
  onToggleLostFound: () => void
}) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { guard } = useAgeGate()
  const { data: attendance } = useAttendance()
  const { data: verification } = useVerificationSnapshot()
  const testTools = useFeatureFlag('test_tools_enabled') === 'on'
  const checkIn = useCheckIn()
  const checkOut = useCheckOut()
  const going = useGoingTonight()
  const [celebrate, setCelebrate] = useState<string | null>(null)

  const here = attendance?.checkIn?.placeId === place.id
  const goingHere = attendance?.going?.placeId === place.id
  const verified = verification ? isAgeVerified(verification) : false
  const checkInError = checkIn.data && !checkIn.data.ok ? checkIn.data.error : null
  const goingError = going.data && !going.data.ok ? going.data.error : null
  const until = attendance?.checkIn?.expiresAt
    ? new Date(attendance.checkIn.expiresAt).toLocaleTimeString(i18n.language, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  const doCheckIn = (simulate: boolean) =>
    checkIn.mutate(
      // Unverified people can check in, but invisibly: they count in stats, not in lists (PRD 5.2.10).
      { placeId: place.id, visible: verified, ...(simulate ? { simulateAt: place.location } : {}) },
      { onSuccess: (result) => result.ok && setCelebrate(place.name) },
    )

  return (
    <section aria-label={t('places.actions')} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={goingHere ? 'secondary' : 'primary'}
          disabled={going.isPending}
          aria-pressed={goingHere}
          onClick={() =>
            guard('going_tonight') && going.mutate({ placeId: place.id, going: !goingHere })
          }
        >
          <MapPin aria-hidden />
          {goingHere ? t('places.going.active') : t('places.going.cta')}
        </Button>
        {here ? (
          <Button
            variant="secondary"
            disabled={checkOut.isPending}
            onClick={() => checkOut.mutate()}
          >
            <MapPinCheck aria-hidden />
            {t('places.checkIn.leave')}
          </Button>
        ) : (
          <Button variant="secondary" disabled={checkIn.isPending} onClick={() => doCheckIn(false)}>
            <Hand aria-hidden />
            {t('places.checkIn.cta')}
          </Button>
        )}
        <Button
          variant="glass"
          onClick={() => guard('view_profiles') && void navigate(`/tonight/swipe/${place.id}`)}
        >
          <Users aria-hidden />
          {t('places.viewProfiles')}
        </Button>
        <Button
          variant="glass"
          onClick={() =>
            document.getElementById('vibe-check')?.scrollIntoView({ behavior: 'smooth' })
          }
        >
          <Vote aria-hidden />
          {t('places.vote')}
        </Button>
      </div>
      <Button variant="outline" size="sm" block onClick={onToggleLostFound}>
        <Package aria-hidden />
        {t('places.lostFound.title')}
      </Button>
      {here && (
        <p className="text-sm text-live" role="status">
          {t('places.checkIn.until', { time: until })}
          {attendance?.checkIn?.visible === false && ` · ${t('places.checkIn.invisible')}`}
        </p>
      )}
      {checkInError && (
        <div
          role="alert"
          className="space-y-2 rounded-2xl border border-warning bg-surface p-3 text-sm"
        >
          <p>{t(`places.checkIn.errors.${checkInError}`)}</p>
          {testTools && (
            <Button size="sm" variant="outline" onClick={() => doCheckIn(true)}>
              {t('places.checkIn.simulate')}
            </Button>
          )}
        </div>
      )}
      {goingError && (
        <p role="alert" className="text-sm text-warning">
          {t('places.going.outsideWindow')}
        </p>
      )}
      {goingHere && testTools && (
        <p className="text-xs text-muted-foreground">{t('places.going.testNote')}</p>
      )}
      <CheckInCelebration placeName={celebrate} onDone={() => setCelebrate(null)} />
    </section>
  )
}
