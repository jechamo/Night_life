import { MapPin, PartyPopper, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAgeGate } from '@/features/verification/hooks/use-age-gate'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'
import { ScreenHeader } from '@/shared/ui/screen-header'

/**
 * Placeholder until Block 3 (swipe stack). Its actions already go through the
 * "Verifica tu edad" gate so the lock can be tested end to end.
 */
export function TonightScreen() {
  const { t } = useTranslation()
  const { guard } = useAgeGate()
  const [allowed, setAllowed] = useState(false)
  return (
    <>
      <ScreenHeader title={t('tabs.tonight')} />
      <EmptyState
        icon={PartyPopper}
        title={t('placeholders.tonight.title')}
        description={t('placeholders.tonight.description')}
        footnote={t('placeholders.upcomingBlock', { block: 3 })}
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => setAllowed(guard('view_profiles'))}>
              <Users aria-hidden />
              {t('tonightPreview.viewProfiles')}
            </Button>
            <Button variant="outline" onClick={() => setAllowed(guard('going_tonight'))}>
              <MapPin aria-hidden />
              {t('tonightPreview.goingTonight')}
            </Button>
          </div>
        }
      />
      {allowed && (
        <p role="status" className="px-safe text-center text-live">
          {t('tonightPreview.verifiedReady')}
        </p>
      )}
    </>
  )
}
